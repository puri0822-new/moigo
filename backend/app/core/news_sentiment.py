"""핵심 이슈가 해당 종목 주가에 호재인지 악재인지 AI로 판단한다.

종목의 이슈 여러 개를 한 번에 보내 호출 한 번으로 끝낸다. 결과는 (종목, 기사 주소)별로 오래 캐시해서
이슈 목록이 10분마다 다시 만들어져도 새로 생긴 이슈만 판단한다.
판단이 늦거나 실패하면 배지 없이 이슈만 내려주고, 늦게 끝난 판단은 다음 요청에 쓰인다.
"""
import asyncio
import logging
import time

from app.core import llm

logger = logging.getLogger("uvicorn.error")

# 앞에 있을수록 먼저 쓴다. 가볍고 빠른 모델 순서
MODEL_ORDER = ("GEMINI", "CLAUDE", "CLOVA")
CACHE_TTL_SECONDS = 6 * 3600
WAIT_SECONDS = 6  # 응답을 이만큼만 기다리고, 넘기면 이번엔 배지 없이 보낸다 (판단은 뒤에서 계속)
SENTIMENTS = {"POSITIVE", "NEUTRAL", "NEGATIVE"}

SYSTEM = """너는 한국 주식 애널리스트다. 한 종목에 대한 뉴스 이슈 목록을 받아, 각 이슈가 그 종목 주가에
호재(POSITIVE)인지 악재(NEGATIVE)인지 중립(NEUTRAL)인지 판단한다.

- 반드시 지정된 종목의 주가 기준으로 판단한다. 경쟁사의 악재가 이 종목에는 호재일 수 있다.
- 단순 홍보·행사·시황 나열이거나 영향이 불분명하면 NEUTRAL.
- "급락 후 반등", "소송 승소", "목표가 하향"처럼 키워드와 실제 의미가 다른 경우를 주의한다.
- reason은 판단 근거를 한국어 40자 이내 한 문장으로.

JSON 객체 하나만 출력한다:
{"items": [{"i": 1, "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE", "reason": "..."}]}"""

# (종목명, 기사 주소) → ({"sentiment", "reason"}, 저장 시각)
_cache: dict[tuple[str, str], tuple[dict, float]] = {}
# 종목별로 진행 중인 판단. 같은 종목을 동시에 여러 번 부르지 않게 한다
_pending: dict[str, asyncio.Task] = {}


def _model() -> str | None:
    return next((m for m in MODEL_ORDER if llm.is_available(m)), None)


def _prompt(stock_name: str, issues: list[dict]) -> str:
    lines = [f"종목: {stock_name}", ""]
    for i, issue in enumerate(issues, 1):
        lines.append(f"[{i}] {issue['title']}")
        if issue.get("summary"):
            lines.append(f"    요약: {issue['summary'][:200]}")
        for r in issue.get("related", [])[:2]:
            lines.append(f"    같은 소식 다른 기사: {r['title']}")
    return "\n".join(lines)


async def _classify(model: str, stock_name: str, issues: list[dict]) -> None:
    try:
        data = await llm.complete_json(model, SYSTEM, _prompt(stock_name, issues), max_tokens=2000, effort="low")
    except llm.LlmError as e:
        logger.warning("뉴스 호재/악재 판단 실패 (%s): %s", stock_name, e)
        return
    now = time.monotonic()
    for item in data.get("items") or []:
        try:
            issue = issues[int(item["i"]) - 1]
        except (KeyError, ValueError, TypeError, IndexError):
            continue
        sentiment = str(item.get("sentiment", "")).upper()
        if sentiment not in SENTIMENTS:
            continue
        reason = str(item.get("reason") or "").strip()[:80] or None
        _cache[(stock_name, issue["url"])] = ({"sentiment": sentiment, "reason": reason}, now)


def _cached(stock_name: str, url: str) -> dict | None:
    hit = _cache.get((stock_name, url))
    if hit and time.monotonic() - hit[1] < CACHE_TTL_SECONDS:
        return hit[0]
    return None


async def attach(stock_name: str, issues: list[dict]) -> None:
    """issues 각각에 sentiment / sentiment_reason을 채운다. 판단하지 못한 이슈는 None."""
    missing = [x for x in issues if _cached(stock_name, x["url"]) is None]
    model = _model()
    if missing and model:
        task = _pending.get(stock_name)
        if task is None or task.done():
            task = asyncio.create_task(_classify(model, stock_name, missing))
            _pending[stock_name] = task
        try:
            # shield: 기다리다 시간이 넘어도 판단 자체는 끝까지 해서 캐시에 남긴다
            await asyncio.wait_for(asyncio.shield(task), WAIT_SECONDS)
        except asyncio.TimeoutError:
            logger.info("뉴스 호재/악재 판단이 늦어 이번엔 생략 (%s)", stock_name)

    for issue in issues:
        hit = _cached(stock_name, issue["url"])
        issue["sentiment"] = hit["sentiment"] if hit else None
        issue["sentiment_reason"] = hit["reason"] if hit else None

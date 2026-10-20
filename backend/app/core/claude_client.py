import json
import logging
import re

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_JSON_RE = re.compile(r"\{[\s\S]*\}")

_SYSTEM = """당신은 한국 주식 뉴스 분석가다.
주어진 종목의 뉴스 목록만 근거로 요약하고 매매 의견을 낸다.
반드시 아래 JSON만 출력한다. 다른 문구·마크다운 금지.
{
  "summary": "한국어 요약 2~4문장",
  "recommendation": "BUY" | "HOLD" | "SELL",
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE"
}
뉴스가 없거나 판단이 어려우면 HOLD/NEUTRAL로 두고 이유를 summary에 적는다.
"""


def _build_prompt(stock_name: str, news_items: list[dict]) -> str:
    if not news_items:
        body = "(뉴스 없음)"
    else:
        lines = []
        for i, n in enumerate(news_items, 1):
            lines.append(
                f"{i}. [{n.get('source') or 'unknown'}] {n['title']}\n"
                f"   {n.get('summary') or ''}\n"
                f"   {n.get('published_at')}"
            )
        body = "\n".join(lines)
    return f"종목: {stock_name}\n\n뉴스:\n{body}"


def _parse_result(text: str) -> dict:
    match = _JSON_RE.search(text)
    if not match:
        raise ValueError("Claude 응답에서 JSON을 찾지 못했습니다")
    data = json.loads(match.group())
    rec = str(data.get("recommendation", "HOLD")).upper()
    sent = str(data.get("sentiment", "NEUTRAL")).upper()
    if rec not in ("BUY", "HOLD", "SELL"):
        rec = "HOLD"
    if sent not in ("POSITIVE", "NEUTRAL", "NEGATIVE"):
        sent = "NEUTRAL"
    return {
        "summary": str(data.get("summary") or "").strip() or "요약 없음",
        "recommendation": rec,
        "sentiment": sent,
    }


def _api_key() -> str:
    return (settings.CLAUDE_API_KEY or settings.ANTHROPIC_API_KEY or "").strip()


async def analyze_news(stock_name: str, news_items: list[dict]) -> dict | None:
    """뉴스 기반 Claude 분석. 키 없거나 실패하면 None."""
    api_key = _api_key()
    if not api_key:
        return None

    payload = {
        "model": settings.ANTHROPIC_MODEL,
        "max_tokens": 1024,
        "system": _SYSTEM,
        "messages": [{"role": "user", "content": _build_prompt(stock_name, news_items)}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
        text = "".join(part.get("text", "") for part in data.get("content", []) if part.get("type") == "text")
        return _parse_result(text)
    except Exception:
        logger.exception("Claude 분석 실패")
        return None

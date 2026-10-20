"""AI 종목 추천 생성과 결과 검증.

- 생성: 종목별 최신 뉴스를 모아 모델에게 보내고, 1주(WEEKLY) 3개·1달(MONTHLY) 2개 추천을 받는다.
  근거 뉴스는 보낸 목록의 번호로만 고르게 해서 지어낸 기사가 들어가지 않게 한다.
- 검증: evaluate_at이 지난 추천을 그날(주말·휴일이면 직전 거래일) 종가로 채점한다.
  매수는 오르면, 매도는 내리면 적중. 틀린 추천은 같은 모델에게 그 사이 뉴스를 주고 실패 이유를 쓰게 한다.
"""

import asyncio
import calendar
import random
import logging
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import exists, func
from sqlalchemy.orm import Session

from app.core import llm, naver_client, toss_client
from app.models.ai_recommendation import (
    AiModel,
    AiRecommendation,
    AiRecommendationEvidence,
    AiRecommendationResult,
)
from app.models.stock import Stock

logger = logging.getLogger(__name__)

KST = ZoneInfo("Asia/Seoul")
PICKS = {"WEEKLY": 3, "MONTHLY": 2}
NEWS_PER_STOCK = 4
NEWS_CONCURRENCY = 5
# 장 마감(15:30) 뒤 종가가 확정됐다고 보는 시각
CLOSE_CONFIRMED = time(15, 40)
MARKET_PROBE_CODE = "005930"
# 대시보드 한 줄 요약 최대 글자 수 (모델이 길게 써도 잘라서 저장한다)
SUMMARY_MAX = 40

GENERATE_SYSTEM = """당신은 한국 주식 애널리스트다. 주어진 종목별 최신 뉴스만 근거로 단기 매매 추천을 낸다.
규칙:
- weekly(1주 뒤 결과 검증)는 정확히 {weekly}개, monthly(1달 뒤 결과 검증)는 정확히 {monthly}개를 채운다. 개수가 모자라면 안 된다.
- 같은 목록 안에서는 서로 다른 종목을 고른다. 목록 앞쪽 종목에 치우치지 말고 전체를 보고 고른다.
- opinion은 BUY(오를 것) 또는 SELL(내릴 것). 뉴스 흐름상 방향이 뚜렷한 종목을 고른다.
- reason은 한국어 1~2문장, 존댓말 없이 "~임/~됨"체로 쓴다.
- summary는 reason의 핵심만 25자 안팎의 한 구절로 쓴다. 종목명은 빼고, 문장 대신 명사형으로 끝낸다 (예: "메모리 80% 장기계약, 이익 가시성↑").
- confidence는 0~100 정수.
- evidence는 그 종목 뉴스 목록에 있는 번호(news_id)만 1~3개 고르고, 각 뉴스가 판단에 어떻게 반영됐는지 insight에 한 문장으로 쓴다.
- 목록에 없는 뉴스나 사실을 지어내지 않는다.
반드시 아래 모양의 JSON 객체만 출력한다. 다른 문장, 마크다운 금지. (예시의 값은 자리 표시일 뿐이다)
{example}"""

FAILURE_SYSTEM = """당신은 한국 주식 애널리스트다. 당신이 했던 추천이 틀렸다. 추천 이후 뉴스와 가격 변화를 보고 왜 틀렸는지 한국어 1~2문장, "~임/~됨"체로 설명한다.
뉴스에 근거가 없으면 추측이라고 밝힌다. 반드시 {"failure_reason": "..."} JSON 객체만 출력한다."""


def _example_json(weekly: int, monthly: int) -> str:
    item = '{"stock_code": "종목코드", "opinion": "BUY 또는 SELL", "confidence": 0, "reason": "...", "summary": "...", "evidence": [{"news_id": "N번호", "insight": "..."}]}'
    return f'{{"weekly": [{", ".join([item] * weekly)}], "monthly": [{", ".join([item] * monthly)}]}}'


def _add_month(dt: datetime) -> datetime:
    # 1월 31일 → 2월 28(29)일처럼 다음 달에 같은 날이 없으면 그 달 마지막 날로 맞춘다
    year, month = (dt.year + 1, 1) if dt.month == 12 else (dt.year, dt.month + 1)
    return dt.replace(year=year, month=month, day=min(dt.day, calendar.monthrange(year, month)[1]))


def evaluate_at_for(period: str, recommended_at: datetime) -> datetime:
    return recommended_at + timedelta(weeks=1) if period == "WEEKLY" else _add_month(recommended_at)


def now_kst() -> datetime:
    return datetime.now(KST)


def _kst_date(dt: datetime) -> date:
    return dt.astimezone(KST).date()


def _candle_date(candle: dict) -> date:
    return date.fromisoformat(candle["timestamp"][:10])


async def market_closed_today() -> bool:
    """오늘이 거래일이고 장 마감 종가가 확정됐는지. 주말·휴장일이면 False."""
    now = now_kst()
    if now.weekday() >= 5 or now.time() < CLOSE_CONFIRMED:
        return False
    try:
        candles = await toss_client.get_candles(MARKET_PROBE_CODE, "1d", 1)
    except httpx.HTTPError:
        return False
    return bool(candles) and _candle_date(candles[-1]) == now.date()


def generated_today(db: Session, model_code: str) -> bool:
    today_start = datetime.combine(now_kst().date(), time.min, KST)
    return db.query(
        exists().where(AiRecommendation.ai_model == model_code, AiRecommendation.recommended_at >= today_start)
    ).scalar()


async def _collect_news(stocks: list[Stock]) -> dict[str, list[dict]]:
    sem = asyncio.Semaphore(NEWS_CONCURRENCY)

    async def one(stock: Stock) -> tuple[str, list[dict]]:
        async with sem:
            try:
                return stock.code, await naver_client.search_news(stock.name, display=NEWS_PER_STOCK, with_images=False)
            except httpx.HTTPError:
                logger.warning("뉴스 수집 실패 %s", stock.name)
                return stock.code, []

    return dict(await asyncio.gather(*(one(s) for s in stocks)))


def _build_news_prompt(stocks: list[Stock], news: dict[str, list[dict]]) -> tuple[str, dict[str, tuple[str, dict]]]:
    """종목별 뉴스 목록 문자열과, 번호(N1, N2...) → (종목 코드, 뉴스) 표를 만든다. 뉴스가 없는 종목은 뺀다."""
    lines: list[str] = []
    index: dict[str, tuple[str, dict]] = {}
    # 모델이 목록 앞쪽 종목만 고르는 경향이 있어 매번 순서를 섞는다
    for s in random.sample(stocks, len(stocks)):
        items = news.get(s.code) or []
        if not items:
            continue
        lines.append(f"[{s.code}] {s.name} ({s.sector or '기타'})")
        for item in items:
            news_id = f"N{len(index) + 1}"
            index[news_id] = (s.code, item)
            summary = (item.get("summary") or "")[:100]
            lines.append(f"  {news_id}. {item['title']} — {summary} ({item['published_at']:%m-%d})")
    return "\n".join(lines), index


async def generate(db: Session, model_code: str) -> list[AiRecommendation]:
    """모델 하나의 오늘 추천을 만들어 저장한다. 실패하면 LlmError."""
    stocks = db.query(Stock).order_by(Stock.id).all()
    news = await _collect_news(stocks)
    news_text, news_index = _build_news_prompt(stocks, news)
    if not news_index:
        raise llm.LlmError("수집된 뉴스가 없습니다")

    by_code = {s.code: s for s in stocks}
    picked: dict[str, list[dict]] = {"WEEKLY": [], "MONTHLY": []}

    def take(period: str, rec: dict) -> None:
        if not isinstance(rec, dict):
            return
        code = str(rec.get("stock_code", "")).strip()
        opinion = str(rec.get("opinion", "")).upper()
        reason = str(rec.get("reason") or "").strip()
        if code not in by_code or opinion not in ("BUY", "SELL") or not reason:
            logger.warning("%s: 형식이 맞지 않는 추천을 버림 %s", model_code, rec)
            return
        if len(picked[period]) >= PICKS[period] or any(p["code"] == code for p in picked[period]):
            return
        # 근거는 그 종목의 뉴스 번호만 인정한다
        evidence = [
            (news_index[ev["news_id"]][1], str(ev.get("insight") or "").strip())
            for ev in rec.get("evidence") or []
            if isinstance(ev, dict) and ev.get("news_id") in news_index and news_index[ev["news_id"]][0] == code
        ][:3]
        if not evidence:
            logger.warning("%s: 근거 뉴스가 없는 추천을 버림 %s", model_code, code)
            return
        try:
            confidence = max(0, min(100, int(rec.get("confidence"))))
        except (TypeError, ValueError):
            confidence = None
        summary = str(rec.get("summary") or "").strip()[:SUMMARY_MAX] or None
        picked[period].append({"code": code, "opinion": opinion, "reason": reason, "summary": summary, "confidence": confidence, "evidence": evidence})

    today = f"오늘은 {now_kst():%Y-%m-%d}이다. 종목별 최신 뉴스:\n\n{news_text}"
    # 모델이 개수를 덜 채우면, 이미 고른 종목을 알려 주고 모자란 개수만 다시 받는다 (최대 3번 요청)
    for attempt in range(3):
        need = {period: PICKS[period] - len(picked[period]) for period in PICKS}
        if not any(need.values()):
            break
        system = GENERATE_SYSTEM.format(weekly=need["WEEKLY"], monthly=need["MONTHLY"], example=_example_json(need["WEEKLY"], need["MONTHLY"]))
        user = today
        if attempt:
            taken = ", ".join(f"{p['code']}({period})" for period, items in picked.items() for p in items)
            user += f"\n\n이미 고른 추천: {taken}. 같은 기간에 같은 종목을 다시 고르지 않는다."
        try:
            data = await llm.complete_json(model_code, system, user)
        except llm.LlmError:
            if attempt == 0:
                raise
            logger.warning("%s: 모자란 추천을 다시 받지 못함", model_code)
            break
        for rec in data.get("weekly") or []:
            take("WEEKLY", rec)
        for rec in data.get("monthly") or []:
            take("MONTHLY", rec)

    chosen = [(period, p) for period, items in picked.items() for p in items]
    if not chosen:
        raise llm.LlmError(f"{model_code}: 쓸 수 있는 추천이 없습니다")

    prices = await toss_client.get_prices(sorted({p["code"] for _, p in chosen}))
    now = now_kst()
    saved: list[AiRecommendation] = []
    for period, p in chosen:
        price = prices.get(p["code"])
        if not price:
            logger.warning("%s: 현재가가 없어 추천을 버림 %s", model_code, p["code"])
            continue
        rec = AiRecommendation(
            ai_model=model_code, period_type=period, stock_id=by_code[p["code"]].id,
            opinion=p["opinion"], reason=p["reason"], summary=p["summary"], confidence=p["confidence"],
            price_at_recommendation=int(float(price["lastPrice"])),
            recommended_at=now, evaluate_at=evaluate_at_for(period, now),
        )
        db.add(rec)
        db.flush()
        for item, insight in p["evidence"]:
            db.add(AiRecommendationEvidence(
                recommendation_id=rec.id, title=item["title"][:500], source=(item.get("source") or "")[:100] or None,
                url=item.get("url"), published_at=item.get("published_at"), insight=insight or "근거 뉴스",
            ))
        saved.append(rec)
    db.commit()
    logger.info("%s: 추천 %d개 저장 (주간 %d, 월간 %d)", model_code, len(saved), len(picked["WEEKLY"]), len(picked["MONTHLY"]))
    return saved


async def _close_on_or_before(code: str, target: date) -> int | None:
    """target 날짜(주말·휴장일이면 그 직전 거래일)의 종가."""
    try:
        candles = await toss_client.get_candles(code, "1d", 60)
    except httpx.HTTPError:
        return None
    closes = [c for c in candles if _candle_date(c) <= target]
    return int(float(closes[-1]["closePrice"])) if closes else None


async def _failure_reason(model_code: str, rec: AiRecommendation, stock: Stock, price_at_eval: int, return_rate: float) -> str | None:
    if not llm.is_available(model_code):
        return None
    try:
        news = await naver_client.search_news(stock.name, display=6, with_images=False)
    except httpx.HTTPError:
        news = []
    news_lines = "\n".join(f"- {n['title']} ({n['published_at']:%m-%d})" for n in news) or "(뉴스 없음)"
    user = (
        f"종목: {stock.name}\n"
        f"추천: {'매수' if rec.opinion == 'BUY' else '매도'} ({rec.recommended_at.astimezone(KST):%Y-%m-%d})\n"
        f"추천 이유: {rec.reason}\n"
        f"가격: {rec.price_at_recommendation:,}원 → {price_at_eval:,}원 ({return_rate * 100:+.2f}%)\n"
        f"추천 이후 뉴스:\n{news_lines}"
    )
    try:
        data = await llm.complete_json(model_code, FAILURE_SYSTEM, user, max_tokens=500)
    except llm.LlmError as e:
        logger.warning("실패 이유 생성 실패 rec=%s: %s", rec.id, e)
        return None
    reason = str(data.get("failure_reason") or "").strip()
    return reason or None


async def evaluate_pending(db: Session) -> int:
    """검증일이 지난 추천을 채점한다. 채점한 개수를 돌려준다."""
    now = now_kst()
    pending = (
        db.query(AiRecommendation, Stock)
        .join(Stock, Stock.id == AiRecommendation.stock_id)
        .filter(
            AiRecommendation.evaluate_at <= func.now(),
            ~exists().where(AiRecommendationResult.recommendation_id == AiRecommendation.id),
        )
        .all()
    )
    done = 0
    for rec, stock in pending:
        target = _kst_date(rec.evaluate_at)
        # 검증일이 오늘인데 아직 종가가 확정되지 않았으면 다음에 한다
        if target == now.date() and now.time() < CLOSE_CONFIRMED:
            continue
        price = await _close_on_or_before(stock.code, target)
        if not price:
            continue
        return_rate = (price - rec.price_at_recommendation) / rec.price_at_recommendation
        is_hit = return_rate > 0 if rec.opinion == "BUY" else return_rate < 0
        failure = None if is_hit else await _failure_reason(rec.ai_model, rec, stock, price, return_rate)
        db.add(AiRecommendationResult(
            recommendation_id=rec.id, price_at_evaluation=price,
            return_rate=round(return_rate, 4), is_hit=is_hit, failure_reason=failure,
        ))
        db.commit()
        done += 1
    if done:
        logger.info("AI 추천 %d개 채점", done)
    return done


SUMMARY_SYSTEM = """주식 추천 이유를 대시보드 한 줄 요약으로 줄인다. 핵심만 25자 안팎의 한 구절로 쓰고, 종목명은 빼고, 문장 대신 명사형으로 끝낸다 (예: "메모리 80% 장기계약, 이익 가시성↑").
반드시 {"summary": "..."} JSON 객체만 출력한다."""


async def fill_missing_summaries(db: Session) -> int:
    """summary가 없는 추천을 그 추천을 낸 모델에게 요약시킨다 (요약 칸이 생기기 전에 만든 추천용)."""
    done = 0
    for rec in db.query(AiRecommendation).filter(AiRecommendation.summary.is_(None)).all():
        if not llm.is_available(rec.ai_model):
            continue
        try:
            data = await llm.complete_json(rec.ai_model, SUMMARY_SYSTEM, rec.reason, max_tokens=300)
            summary = str(data.get("summary") or "")
        except llm.LlmError as e:
            # 짧은 요청에는 CLOVA가 JSON 없이 요약 글만 돌려주곤 한다. 한 줄 길이면 그 글을 그대로 쓴다
            if e.raw_text and len(e.raw_text.strip()) <= SUMMARY_MAX:
                summary = e.raw_text
            else:
                logger.warning("요약 실패 rec=%s: %s", rec.id, e)
                continue
        summary = summary.strip().strip('"').rstrip(".").strip()[:SUMMARY_MAX]
        if summary:
            rec.summary = summary
            db.commit()
            done += 1
    return done


def active_model_codes(db: Session) -> list[str]:
    """새 추천을 만들 모델: DB에서 켜져 있고 키도 있는 모델."""
    rows = db.query(AiModel.code).filter(AiModel.is_active.is_(True)).order_by(AiModel.sort_order).all()
    return [code for (code,) in rows if llm.is_available(code)]

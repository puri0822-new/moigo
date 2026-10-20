"""종목 상세의 AI 등락 이유.

상세 페이지가 부를 때, 그 거래일 이유가 없거나 장중인데 만든 지 1시간이 지났으면
오늘 등락률과 최신 뉴스를 AI에게 주고 2문장으로 쓰게 해서 저장한다. 나머지는 저장된 것을 돌려준다.
"""

import asyncio
import logging
from datetime import datetime, time, timedelta

import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core import llm, naver_client
from app.core.ai_recommender import KST, now_kst
from app.core.price_change import get_price_changes
from app.models.ai_recommendation import StockAiReason
from app.models.stock import Stock

logger = logging.getLogger(__name__)

# 앞에 있는 모델부터, 키가 있는 첫 모델로 쓴다
REASON_MODELS = ("CLAUDE", "GEMINI", "CLOVA")
REFRESH_DURING_MARKET = timedelta(hours=1)
MARKET_OPEN, MARKET_CLOSE = time(9, 0), time(15, 40)
NEWS_COUNT = 8

SYSTEM = """당신은 한국 주식 시황 기자다. 종목의 오늘 등락, 시장 지수 등락, 최신 뉴스 제목을 보고 왜 이렇게 움직였는지 한국어 2문장 이내, "~임/~됨"체로 설명한다.
시장 전체가 크게 움직였으면 그 영향을 먼저 짚고, 뉴스에서 종목 고유의 근거를 찾을 수 있으면 함께 쓴다. 뚜렷한 근거가 없으면 솔직히 그렇다고 쓴다. 주어진 정보에 없는 사실을 지어내지 않는다.
반드시 {"reason": "..."} JSON 객체만 출력한다."""

INDEX_URL = "https://m.stock.naver.com/api/index/{code}/basic"


async def _market_line() -> str:
    """코스피·코스닥의 오늘 등락 (대시보드 지수 카드와 같은 네이버 API). 못 받으면 빈 문자열."""
    parts = []
    async with httpx.AsyncClient(timeout=5) as client:
        for code, name in (("KOSPI", "코스피"), ("KOSDAQ", "코스닥")):
            try:
                resp = await client.get(INDEX_URL.format(code=code))
                resp.raise_for_status()
                parts.append(f"{name} {float(resp.json().get('fluctuationsRatio', 0)):+.2f}%")
            except (httpx.HTTPError, ValueError):
                continue
    return ", ".join(parts)


# 같은 종목 이유를 동시에 여러 번 만들지 않도록 종목별로 막는다
_locks: dict[int, asyncio.Lock] = {}


def _is_fresh(row: StockAiReason) -> bool:
    now = now_kst()
    in_market = now.weekday() < 5 and MARKET_OPEN <= now.time() < MARKET_CLOSE
    return not in_market or now - row.created_at.astimezone(KST) < REFRESH_DURING_MARKET


async def get_reason(db: Session, stock: Stock) -> StockAiReason | None:
    """오늘(최신 거래일) 등락 이유. 쓸 수 있는 모델이 없거나 생성에 실패하면 저장된 최신 이유(없으면 None)."""
    async with _locks.setdefault(stock.id, asyncio.Lock()):
        latest = (
            db.query(StockAiReason)
            .filter(StockAiReason.stock_id == stock.id)
            .order_by(StockAiReason.trade_date.desc())
            .first()
        )
        pc = (await get_price_changes([stock.code])).get(stock.code)
        if pc is None:
            return latest
        if latest and latest.trade_date == pc.trade_date and _is_fresh(latest):
            return latest

        model = next((m for m in REASON_MODELS if llm.is_available(m)), None)
        if model is None:
            return latest
        try:
            news = await naver_client.search_news(stock.name, display=NEWS_COUNT, with_images=False)
        except httpx.HTTPError:
            news = []
        market = await _market_line()
        news_lines = "\n".join(f"- {n['title']} ({n['published_at']:%m-%d %H:%M})" for n in news) or "(관련 뉴스 없음)"
        user = (
            f"종목: {stock.name} ({stock.sector or '기타'})\n"
            f"기준일: {pc.trade_date:%Y-%m-%d}, 현재가 {pc.price:,}원, 전일 대비 {pc.change:+,}원 ({pc.change_rate:+.2f}%)\n"
            f"시장: {market or '(지수 정보 없음)'}\n"
            f"최신 뉴스:\n{news_lines}"
        )
        try:
            data = await llm.complete_json(model, SYSTEM, user, max_tokens=600, effort="low")
        except llm.LlmError as e:
            logger.warning("등락 이유 생성 실패 %s: %s", stock.name, e)
            return latest
        reason = str(data.get("reason") or "").strip()
        if not reason:
            return latest

        values = dict(ai_model=model, change_rate=round(pc.change_rate, 2), reason=reason, created_at=datetime.now(KST))
        db.execute(
            pg_insert(StockAiReason)
            .values(stock_id=stock.id, trade_date=pc.trade_date, **values)
            .on_conflict_do_update(index_elements=["stock_id", "trade_date"], set_=values)
        )
        db.commit()
        return (
            db.query(StockAiReason)
            .filter(StockAiReason.stock_id == stock.id, StockAiReason.trade_date == pc.trade_date)
            .first()
        )

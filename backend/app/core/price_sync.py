import asyncio
import logging

import httpx
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import SQLAlchemyError

from app.core import toss_client
from app.core.database import SessionLocal
from app.models import Stock, StockPriceCache

logger = logging.getLogger("uvicorn.error")

# 시세를 읽는 API(목록/랭킹/상세)는 전부 stock_price_cache 테이블만 읽는다. 사용자 요청마다
# 토스를 호출하지 않도록, 아래 주기로 백그라운드에서만 토스를 호출해 테이블을 갱신한다.
SYNC_INTERVAL_SECONDS = 30
RANKING_TYPE = "MARKET_TRADING_AMOUNT"
# "realtime"은 최근 짧은 구간의 거래량/거래대금이라, 랭킹 밖 종목(일봉 기준 오늘 누적)과 기준이 달라진다.
# "1d"는 오늘 누적값이라 일봉 거래량과 일치하므로 이걸 쓴다. 순위도 오늘 누적 거래대금 기준이 된다.
RANKING_DURATION = "1d"


async def _fetch_rankings_safe() -> dict[str, dict]:
    try:
        return await toss_client.get_rankings(RANKING_TYPE, "KR", RANKING_DURATION, 100)
    except httpx.HTTPError as e:
        logger.warning("랭킹 조회 실패, 전 종목을 개별 조회로 채움: %r", e)
        return {}


async def _fetch_unranked(codes: list[str]) -> dict[str, dict]:
    """랭킹 100위 밖 종목은 현재가(다건 1회) + 일봉(종목별)으로 등락률과 거래량을 직접 계산한다."""
    if not codes:
        return {}

    try:
        prices = await toss_client.get_prices(codes, force=True)
    except httpx.HTTPError as e:
        logger.warning("현재가 조회 실패 %d종목: %r", len(codes), e)
        return {}

    snapshots = await asyncio.gather(*[toss_client.get_daily_snapshot(c) for c in codes], return_exceptions=True)

    result: dict[str, dict] = {}
    failed: list[str] = []
    for code, snapshot in zip(codes, snapshots):
        price = prices.get(code)
        if isinstance(snapshot, Exception):
            # 일시적인 실패로 멀쩡한 등락률/거래량을 null로 덮어쓰지 않도록, 이번 회차는 건너뛰고 기존 행을 유지한다
            failed.append(code)
            continue
        if not price:
            continue
        current_price = int(float(price["lastPrice"]))
        prev_close, volume = snapshot
        result[code] = {
            "current_price": current_price,
            "change_rate": (current_price - prev_close) / prev_close if prev_close else None,
            "trading_volume": volume,
            "trading_amount": None,
            "market_rank": None,
        }
    if failed:
        logger.warning("일봉 조회 실패 %d종목 (이번 회차는 기존 값 유지): %s", len(failed), ", ".join(failed))
    return result


def _row_from_ranking(ranking: dict) -> dict:
    change_rate = ranking["price"].get("changeRate")
    return {
        "current_price": int(float(ranking["price"]["lastPrice"])),
        "change_rate": float(change_rate) if change_rate is not None else None,
        "trading_volume": int(float(ranking["tradingVolume"])),
        "trading_amount": int(float(ranking["tradingAmount"])),
        "market_rank": ranking["rank"],
    }


async def sync_price_cache_once() -> None:
    """토스 랭킹 API(+랭킹 밖 종목은 개별 조회)로 전 종목 시세를 채워 캐시 테이블에 저장."""
    async with SessionLocal() as db:
        stocks = (await db.execute(select(Stock).order_by(Stock.id))).scalars().all()

        rankings = await _fetch_rankings_safe()
        unranked = await _fetch_unranked([s.code for s in stocks if s.code not in rankings])

        rows = []
        for s in stocks:
            if s.code in rankings:
                rows.append({"stock_id": s.id, **_row_from_ranking(rankings[s.code])})
            elif s.code in unranked:
                rows.append({"stock_id": s.id, **unranked[s.code]})
        if not rows:
            return

        stmt = pg_insert(StockPriceCache).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=[StockPriceCache.stock_id],
            set_={
                "current_price": stmt.excluded.current_price,
                "change_rate": stmt.excluded.change_rate,
                "trading_volume": stmt.excluded.trading_volume,
                "trading_amount": stmt.excluded.trading_amount,
                "market_rank": stmt.excluded.market_rank,
                "fetched_at": func.now(),
            },
        )
        try:
            await db.execute(stmt)
            await db.commit()
        except SQLAlchemyError:
            # 캐시 테이블이 아직 없는 등 DB 문제가 있어도 다음 주기에 다시 시도한다
            await db.rollback()
            logger.exception("stock_price_cache 저장 실패")


async def price_sync_loop() -> None:
    while True:
        try:
            await sync_price_cache_once()
        except Exception:
            # 예상 못 한 오류로 루프가 죽으면 시세가 더 이상 갱신되지 않으므로 로그만 남기고 계속 돈다
            logger.exception("시세 캐시 동기화 중 예외")
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)

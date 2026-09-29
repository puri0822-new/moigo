import asyncio
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import SQLAlchemyError

from app.core import toss_client
from app.core.database import SessionLocal
from app.core.price_fetch import fetch_candle_info_safe, fetch_prices_safe
from app.models import Stock, StockPriceCache

logger = logging.getLogger(__name__)

# 실시간 랭킹 화면은 이 캐시 테이블만 읽는다. 대시보드를 새로고침할 때마다 토스를
# 호출하지 않도록, 아래 주기로 백그라운드에서만 토스 API를 호출해 캐시를 갱신한다.
# 토스 랭킹/캔들 응답 자체가 toss_client 내부에서 30초/60초 TTL로 캐시되므로,
# 이보다 더 짧게 잡아도 실제로 더 최신 데이터를 받아오지는 못한다.
SYNC_INTERVAL_SECONDS = 30


async def _fetch_rankings_safe(type_: str) -> dict[str, dict]:
    try:
        return await toss_client.get_rankings(type_, "KR", "realtime", 100)
    except httpx.HTTPError:
        return {}


async def sync_price_cache_once() -> None:
    """토스 랭킹 API(+랭킹 밖 종목은 개별 조회)로 30종목 시세를 모두 채워 캐시 테이블에 저장."""
    async with SessionLocal() as db:
        result = await db.execute(select(Stock).order_by(Stock.id))
        stocks = result.scalars().all()
        codes = [s.code for s in stocks]

        rankings = await _fetch_rankings_safe("MARKET_TRADING_AMOUNT")
        missing_codes = [c for c in codes if c not in rankings]

        fallback_prices = await fetch_prices_safe(missing_codes)
        fallback_candle_info = await fetch_candle_info_safe(missing_codes)

        rows = []
        for s in stocks:
            ranking = rankings.get(s.code)
            if ranking:
                change_rate = ranking["price"].get("changeRate")
                rows.append({
                    "stock_id": s.id,
                    "current_price": int(float(ranking["price"]["lastPrice"])),
                    "change_rate": float(change_rate) if change_rate is not None else None,
                    "trading_volume": int(float(ranking["tradingVolume"])),
                    "trading_amount": int(float(ranking["tradingAmount"])),
                    "market_rank": ranking["rank"],
                })
                continue

            price = fallback_prices.get(s.code)
            if not price:
                continue
            current_price = int(float(price["lastPrice"]))
            candle_info = fallback_candle_info.get(s.code)
            prev_close = candle_info["prev_close"] if candle_info else None
            change_rate = (
                (current_price - prev_close) / prev_close if prev_close else None
            )
            rows.append({
                "stock_id": s.id,
                "current_price": current_price,
                "change_rate": change_rate,
                "trading_volume": int(candle_info["volume"]) if candle_info else None,
                "trading_amount": None,
                "market_rank": None,
            })

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
                "fetched_at": stmt.excluded.fetched_at,
            },
        )
        try:
            await db.execute(stmt)
            await db.commit()
        except SQLAlchemyError:
            # 캐시 테이블이 아직 없는 등 DB 문제가 있어도 다음 주기에 다시 시도한다.
            await db.rollback()
            logger.exception("stock_price_cache 저장 실패")


async def price_sync_loop() -> None:
    while True:
        try:
            await sync_price_cache_once()
        except Exception:
            logger.exception("가격 캐시 동기화 중 알 수 없는 오류")
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)

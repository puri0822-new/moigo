import asyncio
import logging
import time
from datetime import date

import httpx
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import SQLAlchemyError

from app.core import toss_client
from app.database import SessionLocal
from app.models import StockDailyCandle

logger = logging.getLogger(__name__)

# 일봉은 DB(stock_daily_candles)에 쌓아두고 읽는다. 과거 봉은 한 번 받으면 다시 받지 않고,
# 오늘 봉이 바뀌는 만큼만 이 주기마다 최근 몇 개 봉을 토스에서 받아 덮어쓴다(상세페이지 폴링 주기 3초보다 짧게).
RECENT_REFRESH_SECONDS = 2
RECENT_FIRST_PAGE = 3

_locks: dict[int, asyncio.Lock] = {}
_last_refresh: dict[int, float] = {}
_exhausted: set[int] = set()  # 토스에 더 과거 이력이 없는 종목 (서버를 다시 켜면 한 번 더 확인한다)

# DB 세션은 동기(psycopg2)라 DB 작업은 스레드에서 돌린다. 요청의 세션을 쓰면 여기서 커밋할 때 요청이 들고 있는
# ORM 객체가 만료되므로, 일봉 캐시는 짧게 여는 자기 세션을 쓴다.


def _parse(c: dict) -> dict:
    return {
        "trade_date": date.fromisoformat(c["timestamp"][:10]),
        "open_price": int(float(c["openPrice"])),
        "high_price": int(float(c["highPrice"])),
        "low_price": int(float(c["lowPrice"])),
        "close_price": int(float(c["closePrice"])),
        "volume": int(float(c["volume"])),
    }


def _upsert(stock_id: int, rows: list[dict]) -> None:
    if not rows:
        return
    by_date = {r["trade_date"]: r for r in rows}  # 같은 날짜가 한 문장에 두 번 들어가면 ON CONFLICT가 실패한다
    stmt = pg_insert(StockDailyCandle).values([{**r, "stock_id": stock_id} for r in by_date.values()])
    stmt = stmt.on_conflict_do_update(
        index_elements=["stock_id", "trade_date"],
        set_={k: getattr(stmt.excluded, k) for k in ("open_price", "high_price", "low_price", "close_price", "volume")},
    )
    with SessionLocal() as db:
        try:
            db.execute(stmt)
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            logger.exception("stock_daily_candles 저장 실패 (stock_id=%s)", stock_id)


def _summary(stock_id: int) -> tuple[int, date | None, date | None]:
    """저장된 일봉 개수, 가장 오래된 날짜, 가장 최근 날짜."""
    with SessionLocal() as db:
        count, oldest, newest = db.execute(
            select(func.count(), func.min(StockDailyCandle.trade_date), func.max(StockDailyCandle.trade_date))
            .where(StockDailyCandle.stock_id == stock_id)
        ).one()
    return count, oldest, newest


def _read(stock_id: int, total: int) -> list[dict]:
    with SessionLocal() as db:
        rows = db.execute(
            select(StockDailyCandle)
            .where(StockDailyCandle.stock_id == stock_id)
            .order_by(StockDailyCandle.trade_date.desc())
            .limit(total)
        ).scalars().all()
        return [
            {
                "timestamp": f"{r.trade_date.isoformat()}T00:00:00.000+09:00",
                "openPrice": float(r.open_price),
                "highPrice": float(r.high_price),
                "lowPrice": float(r.low_price),
                "closePrice": float(r.close_price),
                "volume": float(r.volume),
            }
            for r in reversed(rows)
        ]


async def _load(
    stock_id: int,
    code: str,
    *,
    first_count: int,
    before: str | None = None,
    want: int | None = None,
    stop_at: date | None = None,
) -> bool:
    """토스에서 일봉을 최신순으로 이어 받아 저장한다. want개 이상 받았거나 stop_at 이전 봉에 닿으면 멈춘다.
    더 받을 이력이 없어서 끝났으면 True."""
    got = 0
    async for page in toss_client.iter_daily_pages(code, first_count, before):
        rows = [_parse(c) for c in page]
        await asyncio.to_thread(_upsert, stock_id, rows)
        got += len(rows)
        if stop_at is not None and min(r["trade_date"] for r in rows) <= stop_at:
            return False
        if want is not None and got >= want:
            return False
    return True


async def _ensure(stock_id: int, code: str, total: int) -> None:
    count, oldest, newest = await asyncio.to_thread(_summary, stock_id)
    now = time.monotonic()

    if count == 0:
        if await _load(stock_id, code, first_count=min(200, total), want=total):
            _exhausted.add(stock_id)
        _last_refresh[stock_id] = now
        return

    if now - _last_refresh.get(stock_id, 0.0) >= RECENT_REFRESH_SECONDS:
        await _load(stock_id, code, first_count=RECENT_FIRST_PAGE, stop_at=newest)
        _last_refresh[stock_id] = now

    if count < total and stock_id not in _exhausted:
        # before는 해당 날짜의 봉을 포함하므로 이미 있는 가장 오래된 봉이 한 번 더 온다. 그만큼 더 요구한다.
        missing = total - count
        before = f"{oldest.isoformat()}T00:00:00.000+09:00"
        if await _load(stock_id, code, first_count=min(200, missing + 1), before=before, want=missing + 1):
            _exhausted.add(stock_id)


async def get_daily_bars(stock_id: int, code: str, total: int) -> list[dict]:
    """최근 일봉 total개를 오래된 것부터 반환한다(토스 응답과 같은 형태의 dict라 aggregate_daily에 그대로 넘길 수 있다).
    토스 호출이 실패해도 DB에 있는 만큼은 돌려준다."""
    lock = _locks.setdefault(stock_id, asyncio.Lock())
    async with lock:
        try:
            await _ensure(stock_id, code, total)
        except httpx.HTTPError as e:
            logger.warning("일봉 갱신 실패, DB에 있는 값으로 응답 (%s): %r", code, e)
        return await asyncio.to_thread(_read, stock_id, total)

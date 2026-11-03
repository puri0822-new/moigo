import asyncio
import logging
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.market_hours import is_market_open, last_market_close, now_kst
from app.core.price_change import PriceChange, get_price_changes
from app.database import SessionLocal
from app.models.stock import Stock
from app.models.user import User
from app.models.watchlist import Notification, Watchlist

logger = logging.getLogger("uvicorn.error")

ALERT_STEP = 5   # ±5%, ±10%, ±15%... 단계를 넘을 때마다 알린다
CHECK_INTERVAL_SECONDS = 30
# 장 마감 직후의 종가까지 반영하도록 마감 뒤 잠깐은 계속 확인한다
AFTER_CLOSE_GRACE = timedelta(minutes=10)


def _targets() -> list[tuple[int, int, str]]:
    """알림을 켠 (사용자 id, 종목 id, 종목 코드). 회원 설정에서 알림을 끈 사용자는 뺀다."""
    with SessionLocal() as db:
        rows = db.execute(
            select(Watchlist.user_id, Stock.id, Stock.code)
            .join(Stock, Stock.id == Watchlist.stock_id)
            .join(User, User.id == Watchlist.user_id)
            .where(Watchlist.alert_enabled.is_(True), User.price_alert_enabled.is_(True))
        ).all()
        return [(user_id, stock_id, code) for user_id, stock_id, code in rows]


def _save(targets: list[tuple[int, int, str]], changes: dict[str, PriceChange]) -> None:
    values = []
    for user_id, stock_id, code in targets:
        pc = changes.get(code)
        if not pc:
            continue
        level = int(abs(pc.change_rate) // ALERT_STEP) * ALERT_STEP
        if level < ALERT_STEP:
            continue
        # 한 번에 여러 단계를 건너뛰면 가장 높은 단계 하나만 알린다
        values.append(dict(
            user_id=user_id, stock_id=stock_id,
            direction="UP" if pc.change_rate > 0 else "DOWN",
            level=level, change_rate=round(pc.change_rate, 2), price=pc.price, trade_date=pc.trade_date,
        ))
    if not values:
        return
    with SessionLocal() as db:
        # 같은 날 같은 단계는 한 번만 (여러 서버가 같은 DB를 써도 중복되지 않는다)
        db.execute(
            pg_insert(Notification)
            .values(values)
            .on_conflict_do_nothing(index_elements=["user_id", "stock_id", "trade_date", "direction", "level"])
        )
        db.commit()


async def detect_once() -> None:
    """알림을 켠 관심 종목의 등락률이 새 단계를 넘었으면 알림을 만든다. DB 작업은 스레드에서 돌린다."""
    targets = await asyncio.to_thread(_targets)
    if not targets:
        return
    changes = await get_price_changes(sorted({code for _, _, code in targets}))
    if changes:
        await asyncio.to_thread(_save, targets, changes)


async def price_alert_loop() -> None:
    """접속하지 않은 사용자의 알림도 놓치지 않도록 백그라운드에서 확인한다.
    장중과 마감 직후에만 돈다. 서버를 켠 직후에는 한 번 확인해 꺼져 있던 동안의 등락을 채운다."""
    first = True
    while True:
        now = now_kst()
        if first or is_market_open(now) or now - last_market_close(now) < AFTER_CLOSE_GRACE:
            try:
                await detect_once()
            except Exception:
                # 예상 못 한 오류로 루프가 죽으면 알림이 더 이상 생기지 않으므로 로그만 남기고 계속 돈다
                logger.exception("가격 알림 확인 중 예외")
        first = False
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)

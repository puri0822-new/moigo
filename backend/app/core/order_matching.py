import asyncio
import logging
from datetime import datetime

import httpx
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core import toss_client
from app.core.market_hours import KST, is_market_open, last_market_close, now_kst
from app.database import SessionLocal
from app.models.account import Account
from app.models.holding import Holding
from app.models.order import Order
from app.models.stock import Stock

logger = logging.getLogger("uvicorn.error")

# 미체결 주문을 호가와 다시 맞춰 보는 주기. 토스 호가 캐시(2초)보다 조금 길게 둔다.
MATCH_INTERVAL_SECONDS = 3

PENDING = "PENDING"
FILLED = "FILLED"
CANCELLED = "CANCELLED"
EXPIRED = "EXPIRED"


def is_orderbook_live(book: dict, now: datetime) -> bool:
    """호가가 오늘 것인지. 평일이어도 휴장일이면 토스가 지난 거래일의 호가를 주므로 그때는 체결하지 않는다."""
    try:
        stamped = datetime.fromisoformat(book["timestamp"]).astimezone(KST)
    except (KeyError, ValueError):
        return False
    return stamped.date() == now.astimezone(KST).date()


def plan_fill(order_type: str, quantity: int, book: dict, limit_price: int | None) -> int | None:
    """호가 잔량을 현재가에 가까운 단계부터 차례로 소진해 주문 수량 전부를 체결했을 때의 총 금액.
    매수는 매도호가(asks)를, 매도는 매수호가(bids)를 소진한다. 지정가면 그 가격보다 불리한 단계는 쓰지 않는다.
    수량 전부를 채울 수 없으면 None (부분 체결은 지원하지 않아 전량이 체결 가능할 때까지 기다린다)."""
    levels = book.get("asks" if order_type == "BUY" else "bids") or []
    remaining = quantity
    total = 0
    for level in levels:
        price = int(float(level["price"]))
        volume = int(float(level["volume"]))
        if limit_price is not None:
            if order_type == "BUY" and price > limit_price:
                break
            if order_type == "SELL" and price < limit_price:
                break
        take = min(remaining, volume)
        total += take * price
        remaining -= take
        if remaining == 0:
            return total
    return None


def reserved_cash(db: Session, user_id: int) -> int:
    """미체결 매수 주문에 묶여 있는 금액 (지정가 × 수량의 합)."""
    return db.execute(
        select(func.coalesce(func.sum(Order.limit_price * Order.quantity), 0))
        .where(Order.user_id == user_id, Order.status == PENDING, Order.order_type == "BUY")
    ).scalar_one()


def reserved_shares(db: Session, user_id: int) -> dict[int, int]:
    """미체결 매도 주문에 묶여 있는 수량 (종목 id → 수량)."""
    rows = db.execute(
        select(Order.stock_id, func.sum(Order.quantity))
        .where(Order.user_id == user_id, Order.status == PENDING, Order.order_type == "SELL")
        .group_by(Order.stock_id)
    ).all()
    return {stock_id: int(qty) for stock_id, qty in rows}


def apply_fill(db: Session, order: Order, account: Account, holding: Holding | None, total_amount: int) -> bool:
    """체결을 잔고·보유 종목·주문에 반영한다 (커밋은 호출하는 쪽에서). account와 holding은 잠근 행이어야 한다.
    잔고나 보유 수량이 모자라 반영할 수 없으면 아무것도 바꾸지 않고 False."""
    if order.order_type == "BUY":
        if account.balance < total_amount:
            return False
        account.balance -= total_amount
        if holding:
            total_qty = holding.quantity + order.quantity
            holding.avg_price = (holding.avg_price * holding.quantity + total_amount) // total_qty
            holding.quantity = total_qty
        else:
            db.add(Holding(
                user_id=order.user_id,
                stock_id=order.stock_id,
                quantity=order.quantity,
                avg_price=total_amount // order.quantity,
            ))
    else:
        if not holding or holding.quantity < order.quantity:
            return False
        account.balance += total_amount
        holding.quantity -= order.quantity
        if holding.quantity == 0:
            db.delete(holding)

    order.status = FILLED
    # 여러 호가 단계에 걸쳐 체결되면 단가는 평균 체결가(반올림)다. 실제로 오간 금액은 total_amount가 정확하다.
    order.price = max(1, round(total_amount / order.quantity))
    order.total_amount = total_amount
    order.filled_at = func.now()
    return True


def _try_fill_pending(db: Session, order_id: int, book: dict) -> None:
    # 취소 요청과 겹치지 않도록 주문 행을 잠그고 아직 미체결인지 다시 확인한다
    order = db.execute(
        select(Order).where(Order.id == order_id, Order.status == PENDING).with_for_update()
    ).scalar_one_or_none()
    if not order:
        return

    total = plan_fill(order.order_type, order.quantity, book, order.limit_price)
    if total is None:
        return

    account = db.execute(select(Account).where(Account.id == order.account_id).with_for_update()).scalar_one()
    holding = db.execute(
        select(Holding).where(Holding.user_id == order.user_id, Holding.stock_id == order.stock_id).with_for_update()
    ).scalar_one_or_none()

    if not apply_fill(db, order, account, holding, total):
        # 주문을 받을 때 묶어 둔 잔고·수량 범위 안에서만 체결되므로 정상적으로는 오지 않는 경로다
        logger.warning("미체결 주문 %s: 잔고/보유 수량이 모자라 취소", order.id)
        order.status = CANCELLED


def expire_stale_orders(db: Session, now: datetime) -> None:
    """미체결 주문은 당일 장 마감까지만 유효하다. 주문 뒤로 장 마감이 한 번 지났으면 만료시킨다
    (장 마감 후에 넣은 주문은 다음 거래일 장 마감까지 유효)."""
    result = db.execute(
        update(Order).where(Order.status == PENDING, Order.ordered_at < last_market_close(now)).values(status=EXPIRED)
    )
    db.commit()
    if result.rowcount:
        logger.info("장 마감으로 미체결 주문 %d건 만료", result.rowcount)


async def match_pending_once() -> None:
    now = now_kst()
    with SessionLocal() as db:
        if not is_market_open(now):
            expire_stale_orders(db, now)
            return
        targets = db.execute(
            select(Order.stock_id, Stock.code)
            .join(Stock, Stock.id == Order.stock_id)
            .where(Order.status == PENDING)
            .distinct()
        ).all()

    for stock_id, code in targets:
        try:
            book = await toss_client.get_orderbook(code)
        except httpx.HTTPError as e:
            logger.warning("미체결 주문 체결용 호가 조회 실패 %s: %r", code, e)
            continue
        if not is_orderbook_live(book, now):
            continue

        with SessionLocal() as db:
            order_ids = db.execute(
                select(Order.id).where(Order.stock_id == stock_id, Order.status == PENDING).order_by(Order.ordered_at, Order.id)
            ).scalars().all()
            for order_id in order_ids:
                try:
                    _try_fill_pending(db, order_id, book)
                    db.commit()
                except Exception:
                    db.rollback()
                    logger.exception("미체결 주문 %s 체결 처리 실패", order_id)


async def order_matching_loop() -> None:
    while True:
        try:
            await match_pending_once()
        except Exception:
            # 예상 못 한 오류로 루프가 죽으면 미체결 주문이 영영 체결되지 않으므로 로그만 남기고 계속 돈다
            logger.exception("미체결 주문 체결 루프 예외")
        await asyncio.sleep(MATCH_INTERVAL_SECONDS)

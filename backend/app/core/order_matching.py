"""미체결 주문을 호가와 맞춰 체결한다. 부분 체결·매수 예약금·체결 알림을 지원한다."""

import asyncio
import logging
from datetime import datetime

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import toss_client
from app.core.market_hours import KST, is_market_open, last_market_close, now_kst
from app.database import SessionLocal
from app.models.account import Account
from app.models.holding import Holding
from app.models.order import Order
from app.models.stock import Stock
from app.models.watchlist import Notification

logger = logging.getLogger("uvicorn.error")

MATCH_INTERVAL_SECONDS = 3

PENDING = "PENDING"
FILLED = "FILLED"
CANCELLED = "CANCELLED"
EXPIRED = "EXPIRED"


def remaining_qty(order: Order) -> int:
    return max(0, order.quantity - order.filled_quantity)


def is_orderbook_live(book: dict, now: datetime) -> bool:
    """호가가 오늘 것인지. 휴장일이면 토스가 지난 거래일 호가를 주므로 그때는 체결하지 않는다."""
    try:
        stamped = datetime.fromisoformat(book["timestamp"]).astimezone(KST)
    except (KeyError, ValueError):
        return False
    return stamped.date() == now.astimezone(KST).date()


def plan_fill(order_type: str, quantity: int, book: dict, limit_price: int | None) -> tuple[int, int] | None:
    """호가에서 지금 체결 가능한 (수량, 총 금액). 부분 체결이면 가능한 만큼만.
    매수는 asks, 매도는 bids를 현재가에 가까운 단계부터 쓴다. 한 주도 못 채우면 None."""
    if quantity <= 0:
        return None
    levels = book.get("asks" if order_type == "BUY" else "bids") or []
    remaining = quantity
    total = 0
    filled = 0
    for level in levels:
        price = int(float(level["price"]))
        volume = int(float(level["volume"]))
        if limit_price is not None:
            if order_type == "BUY" and price > limit_price:
                break
            if order_type == "SELL" and price < limit_price:
                break
        if volume <= 0:
            continue
        take = min(remaining, volume)
        total += take * price
        filled += take
        remaining -= take
        if remaining == 0:
            break
    if filled == 0:
        return None
    return filled, total


def copy_book(book: dict) -> dict:
    return {**book, "asks": [dict(l) for l in book.get("asks") or []], "bids": [dict(l) for l in book.get("bids") or []]}


def consume_book(book: dict, order_type: str, quantity: int) -> None:
    remaining = quantity
    for level in book.get("asks" if order_type == "BUY" else "bids") or []:
        if remaining == 0:
            return
        volume = int(float(level["volume"]))
        take = min(remaining, volume)
        level["volume"] = volume - take
        remaining -= take


def reserved_cash(db: Session, user_id: int) -> int:
    """미체결 매수에 묶인 예약금 합(escrow). 잔고에는 이미 빠져 있으므로 표시용."""
    return int(db.execute(
        select(func.coalesce(func.sum(Order.escrow_amount), 0))
        .where(Order.user_id == user_id, Order.status == PENDING, Order.order_type == "BUY")
    ).scalar_one())


def reserved_shares(db: Session, user_id: int) -> dict[int, int]:
    """미체결 매도에 묶인 남은 수량 (종목 id → 수량)."""
    rows = db.execute(
        select(Order.stock_id, func.sum(Order.quantity - Order.filled_quantity))
        .where(Order.user_id == user_id, Order.status == PENDING, Order.order_type == "SELL")
        .group_by(Order.stock_id)
    ).all()
    return {stock_id: int(qty) for stock_id, qty in rows}


def notify_order_fill(db: Session, order: Order, fill_qty: int, fill_total: int) -> None:
    """예약 주문을 쓰지 않으므로 체결 알림은 만들지 않는다. (즉시 체결은 토스트로 안내)"""
    return


def apply_fill(db: Session, order: Order, account: Account, holding: Holding | None, fill_qty: int, total_amount: int) -> bool:
    """부분·전량 체결을 잔고·보유·주문에 반영한다 (커밋은 호출 쪽). False면 잔고/수량 부족."""
    left = remaining_qty(order)
    if fill_qty <= 0 or fill_qty > left:
        return False

    if order.order_type == "BUY":
        if order.escrow_amount > 0 and order.limit_price:
            # 예약금에서 이번 체결분(지정가×수량)을 쓰고, 실제 체결가와의 차액은 잔고로 환불
            reserved_slice = order.limit_price * fill_qty
            if order.escrow_amount < reserved_slice:
                return False
            order.escrow_amount -= reserved_slice
            refund = reserved_slice - total_amount
            if refund < 0:
                return False
            account.balance += refund
        else:
            if account.balance < total_amount:
                return False
            account.balance -= total_amount

        if holding:
            total_qty = holding.quantity + fill_qty
            holding.avg_price = (holding.avg_price * holding.quantity + total_amount) // total_qty
            holding.quantity = total_qty
        else:
            holding = Holding(
                user_id=order.user_id,
                stock_id=order.stock_id,
                quantity=fill_qty,
                avg_price=max(1, total_amount // fill_qty),
            )
            db.add(holding)
    else:
        if not holding or holding.quantity < fill_qty:
            return False
        account.balance += total_amount
        holding.quantity -= fill_qty
        if holding.quantity == 0:
            db.delete(holding)

    order.filled_quantity += fill_qty
    order.filled_amount += total_amount
    order.price = max(1, round(order.filled_amount / order.filled_quantity))
    order.total_amount = order.filled_amount
    order.filled_at = func.now()
    if order.filled_quantity >= order.quantity:
        order.status = FILLED
        # 남은 예약금이 있으면 전액 환불 (이론상 0)
        if order.escrow_amount > 0:
            account.balance += order.escrow_amount
            order.escrow_amount = 0

    notify_order_fill(db, order, fill_qty, total_amount)
    return True


def cancel_pending(db: Session, order: Order, account: Account) -> None:
    """미체결 취소·만료: 매수 예약금 환불."""
    if order.escrow_amount > 0:
        account.balance += order.escrow_amount
        order.escrow_amount = 0
    order.status = CANCELLED


def _try_fill_pending(db: Session, order_id: int, book: dict) -> tuple[str, int] | None:
    order = db.execute(
        select(Order).where(Order.id == order_id, Order.status == PENDING).with_for_update()
    ).scalar_one_or_none()
    if not order:
        return None

    planned = plan_fill(order.order_type, remaining_qty(order), book, order.limit_price)
    if planned is None:
        return None
    fill_qty, total = planned

    account = db.execute(select(Account).where(Account.id == order.account_id).with_for_update()).scalar_one()
    holding = db.execute(
        select(Holding).where(Holding.user_id == order.user_id, Holding.stock_id == order.stock_id).with_for_update()
    ).scalar_one_or_none()

    if not apply_fill(db, order, account, holding, fill_qty, total):
        logger.warning("미체결 주문 %s: 잔고/보유 수량이 모자라 취소", order.id)
        cancel_pending(db, order, account)
        return None
    return order.order_type, fill_qty


def expire_stale_orders(db: Session, now: datetime) -> None:
    """지난 장 마감 이전에 남은 미체결을 만료하고 예약금을 환불한다."""
    cutoff = last_market_close(now)
    orders = db.execute(
        select(Order).where(Order.status == PENDING, Order.ordered_at < cutoff).with_for_update()
    ).scalars().all()
    if not orders:
        return
    for order in orders:
        account = db.execute(
            select(Account).where(Account.id == order.account_id).with_for_update()
        ).scalar_one()
        if order.escrow_amount > 0:
            account.balance += order.escrow_amount
            order.escrow_amount = 0
        order.status = EXPIRED
    db.commit()
    logger.info("장 마감으로 미체결 주문 %d건 만료", len(orders))


def _pending_targets(now: datetime) -> list[tuple[int, str]]:
    with SessionLocal() as db:
        if not is_market_open(now):
            expire_stale_orders(db, now)
            return []
        rows = db.execute(
            select(Order.stock_id, Stock.code)
            .join(Stock, Stock.id == Order.stock_id)
            .where(Order.status == PENDING)
            .distinct()
        ).all()
        return [(stock_id, code) for stock_id, code in rows]


def _fill_stock_orders(stock_id: int, book: dict) -> None:
    with SessionLocal() as db:
        order_ids = db.execute(
            select(Order.id).where(Order.stock_id == stock_id, Order.status == PENDING).order_by(Order.ordered_at, Order.id)
        ).scalars().all()
        for order_id in order_ids:
            try:
                filled = _try_fill_pending(db, order_id, book)
                db.commit()
            except Exception:
                db.rollback()
                logger.exception("미체결 주문 %s 체결 처리 실패", order_id)
                continue
            if filled:
                consume_book(book, *filled)


async def match_pending_once() -> None:
    now = now_kst()
    targets = await asyncio.to_thread(_pending_targets, now)
    for stock_id, code in targets:
        try:
            book = await toss_client.get_orderbook(code)
        except httpx.HTTPError as e:
            logger.warning("미체결 주문 체결용 호가 조회 실패 %s: %r", code, e)
            continue
        if not is_orderbook_live(book, now):
            continue
        await asyncio.to_thread(_fill_stock_orders, stock_id, copy_book(book))


async def order_matching_loop() -> None:
    while True:
        try:
            await match_pending_once()
        except Exception:
            logger.exception("미체결 주문 체결 루프 예외")
        await asyncio.sleep(MATCH_INTERVAL_SECONDS)

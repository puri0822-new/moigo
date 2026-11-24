import asyncio
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.database import get_db
from app.core import toss_client
from app.core.dependencies import get_current_user
from app.core.market_hours import is_market_open, now_kst
from app.core.order_matching import (
    PENDING,
    apply_fill,
    cancel_pending,
    is_orderbook_live,
    plan_fill,
    reserved_shares,
)
from app.models.user import User
from app.models.account import Account
from app.models.stock import Stock
from app.models.order import Order
from app.models.holding import Holding
from app.schemas.order import OrderRequest

router = APIRouter(prefix="/orders", tags=["orders"])
logger = logging.getLogger("uvicorn.error")

ORDERBOOK_TIMEOUT_SECONDS = 6


def _order_dict(order: Order, stock: Stock | None) -> dict:
    return {
        "id": order.id,
        "stock_name": stock.name if stock else "",
        "stock_code": stock.code if stock else "",
        "order_type": order.order_type,
        "price_type": order.price_type,
        "status": order.status,
        "quantity": order.quantity,
        "filled_quantity": order.filled_quantity,
        "price": order.price,
        "total_amount": order.total_amount,
        "limit_price": order.limit_price,
        "escrow_amount": order.escrow_amount,
        "ordered_at": order.ordered_at,
        "filled_at": order.filled_at,
    }


async def _live_orderbook(code: str) -> dict | None:
    now = now_kst()
    if not is_market_open(now):
        return None
    try:
        book = await asyncio.wait_for(toss_client.get_orderbook(code), ORDERBOOK_TIMEOUT_SECONDS)
    except (httpx.HTTPError, asyncio.TimeoutError) as e:
        logger.warning("주문용 호가 조회 실패 %s: %r", code, e)
        raise HTTPException(status_code=503, detail="호가를 확인할 수 없어 주문할 수 없습니다. 잠시 후 다시 시도해주세요")
    return book if is_orderbook_live(book, now) else None


@router.post("", status_code=201)
async def create_order(
    body: OrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stock = await run_in_threadpool(db.get, Stock, body.stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    is_limit = body.price_type == "LIMIT"
    if is_limit and body.price is None:
        raise HTTPException(status_code=400, detail="지정가 주문은 가격을 입력해야 합니다")
    limit_price = body.price if is_limit else None

    book = await _live_orderbook(stock.code)
    if book is None:
        raise HTTPException(
            status_code=400,
            detail="장 운영시간(평일 09:00~15:30)에만 주문할 수 있습니다",
        )

    # 예약 주문 없음 — 지금 호가로 전량 체결될 때만 받는다
    planned = plan_fill(body.order_type, body.quantity, book, limit_price)
    if planned is None or planned[0] < body.quantity:
        side = "매수" if body.order_type == "BUY" else "매도"
        hint = "가격을 높이거나 수량을 줄여주세요" if body.order_type == "BUY" else "가격을 낮추거나 수량을 줄여주세요"
        raise HTTPException(
            status_code=400,
            detail=f"지금 호가로 전량 {side}할 수 없습니다. {hint}",
        )

    return await run_in_threadpool(_place_order, db, current_user.id, body, stock, limit_price, planned)


def _place_order(
    db: Session,
    user_id: int,
    body: OrderRequest,
    stock: Stock,
    limit_price: int | None,
    planned: tuple[int, int],
) -> dict:
    account = db.query(Account).filter(Account.user_id == user_id).with_for_update().first()
    if not account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다")

    holding = db.query(Holding).filter(
        Holding.user_id == user_id,
        Holding.stock_id == body.stock_id,
    ).with_for_update().first()

    fill_qty, fill_total = body.quantity, planned[1]

    if body.order_type == "BUY":
        if account.balance < fill_total:
            raise HTTPException(status_code=400, detail="주문 가능 금액이 부족합니다")
    else:
        held = holding.quantity if holding else 0
        if held - reserved_shares(db, user_id).get(body.stock_id, 0) < body.quantity:
            raise HTTPException(status_code=400, detail="주문 가능 수량이 부족합니다")

    reference_price = max(1, round(fill_total / body.quantity))
    order = Order(
        user_id=user_id,
        account_id=account.id,
        stock_id=body.stock_id,
        ai_analysis_id=body.ai_analysis_id,
        order_type=body.order_type,
        price_type=body.price_type,
        status=PENDING,
        quantity=body.quantity,
        limit_price=limit_price,
        price=reference_price,
        total_amount=fill_total,
        filled_quantity=0,
        filled_amount=0,
        escrow_amount=0,
    )
    db.add(order)
    db.flush()

    if not apply_fill(db, order, account, holding, fill_qty, fill_total):
        raise HTTPException(status_code=400, detail="주문을 체결할 수 없습니다")

    db.commit()
    db.refresh(order)

    return {"success": True, "data": _order_dict(order, stock), "message": "주문이 체결되었습니다"}


@router.get("")
def get_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    orders = db.query(Order).filter(Order.user_id == current_user.id).order_by(Order.ordered_at.desc()).all()
    data = []
    for o in orders:
        stock = db.query(Stock).filter(Stock.id == o.stock_id).first()
        data.append(_order_dict(o, stock))
    return {"success": True, "data": data, "message": "요청 성공"}


@router.delete("/{order_id}")
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id,
    ).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    if order.status != PENDING:
        raise HTTPException(status_code=400, detail="이미 체결되었거나 취소된 주문입니다")

    account = db.query(Account).filter(Account.id == order.account_id).with_for_update().first()
    if not account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다")

    cancel_pending(db, order, account)
    db.commit()
    db.refresh(order)

    stock = db.query(Stock).filter(Stock.id == order.stock_id).first()
    return {"success": True, "data": _order_dict(order, stock), "message": "주문이 취소되었습니다"}

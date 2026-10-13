import asyncio
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.core import toss_client
from app.core.dependencies import get_current_user
from app.core.market_hours import is_market_open, now_kst
from app.core.order_matching import (
    CANCELLED, PENDING, apply_fill, is_orderbook_live, plan_fill, reserved_cash, reserved_shares,
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
        # 체결된 주문은 평균 체결가·실제 체결 금액, 미체결 주문은 지정가·지정가 기준 금액
        "price": order.price,
        "total_amount": order.total_amount,
        "limit_price": order.limit_price,
        "ordered_at": order.ordered_at,
        "filled_at": order.filled_at,
    }


async def _live_orderbook(code: str) -> dict | None:
    """지금 체결에 쓸 수 있는 호가. 장 운영시간이 아니거나 휴장일이면 None.
    장중인데 호가를 못 받아오면 503 (체결 여부를 판단할 수 없으므로 주문을 받지 않는다)."""
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
    current_user: User = Depends(get_current_user)
):
    # 종목 확인
    stock = db.query(Stock).filter(Stock.id == body.stock_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    is_limit = body.price_type == "LIMIT"
    if is_limit and body.price is None:
        raise HTTPException(status_code=400, detail="지정가 주문은 가격을 입력해야 합니다")
    limit_price = body.price if is_limit else None

    # 체결가는 클라이언트가 보낸 가격이 아니라 실제 호가로 정한다.
    # 매수는 매도호가를, 매도는 매수호가를 현재가에 가까운 단계부터 잔량만큼 소진한다.
    book = await _live_orderbook(stock.code)
    if book is None and not is_limit:
        raise HTTPException(
            status_code=400,
            detail="장 운영시간(평일 09:00~15:30)이 아니라 시장가 주문을 할 수 없습니다. 지정가로 주문하면 다음 장에 체결을 시도합니다",
        )
    fill_total = plan_fill(body.order_type, body.quantity, book, limit_price) if book else None
    if fill_total is None and not is_limit:
        raise HTTPException(status_code=400, detail="호가 잔량이 부족해 시장가로 체결할 수 없습니다. 수량을 줄이거나 지정가로 주문해주세요")

    # 계좌 확인 (동시에 들어온 주문이 같은 잔고를 기준으로 계산하지 않도록 행을 잠근다)
    account = db.query(Account).filter(Account.user_id == current_user.id).with_for_update().first()
    if not account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다")

    holding = db.query(Holding).filter(
        Holding.user_id == current_user.id,
        Holding.stock_id == body.stock_id
    ).with_for_update().first()

    # 미체결 주문에 묶인 금액·수량은 다른 주문에 다시 쓸 수 없다
    if body.order_type == "BUY":
        # 지정가는 더 싸게 체결되더라도 지정가 기준으로 주문 가능 금액을 확인한다
        required = limit_price * body.quantity if is_limit else fill_total
        if account.balance - reserved_cash(db, current_user.id) < required:
            raise HTTPException(status_code=400, detail="주문 가능 금액이 부족합니다")
    else:
        held = holding.quantity if holding else 0
        if held - reserved_shares(db, current_user.id).get(body.stock_id, 0) < body.quantity:
            raise HTTPException(status_code=400, detail="주문 가능 수량이 부족합니다")

    # 일단 미체결로 만들고, 지금 호가로 전량 체결할 수 있으면 바로 체결한다
    reference_price = limit_price if is_limit else max(1, round(fill_total / body.quantity))
    order = Order(
        user_id=current_user.id,
        account_id=account.id,
        stock_id=body.stock_id,
        ai_analysis_id=body.ai_analysis_id,
        order_type=body.order_type,
        price_type=body.price_type,
        status=PENDING,
        quantity=body.quantity,
        limit_price=limit_price,
        price=reference_price,
        total_amount=reference_price * body.quantity,
    )
    db.add(order)
    if fill_total is not None and not apply_fill(db, order, account, holding, fill_total):
        # 위에서 주문 가능 금액·수량을 확인했으므로 정상적으로는 오지 않는 경로다
        raise HTTPException(status_code=400, detail="주문을 체결할 수 없습니다")
    db.commit()
    db.refresh(order)

    filled = order.status != PENDING
    return {
        "success": True,
        "data": _order_dict(order, stock),
        "message": "주문이 체결되었습니다" if filled else "주문이 접수되었습니다. 지정가에 도달하면 체결됩니다",
    }


@router.get("")
def get_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    orders = db.query(Order).filter(
        Order.user_id == current_user.id
    ).order_by(Order.ordered_at.desc()).all()

    data = []
    for o in orders:
        stock = db.query(Stock).filter(Stock.id == o.stock_id).first()
        data.append(_order_dict(o, stock))

    return {"success": True, "data": data, "message": "요청 성공"}


@router.delete("/{order_id}")
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 체결 처리와 겹치지 않도록 주문 행을 잠근다
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    if order.status != PENDING:
        raise HTTPException(status_code=400, detail="이미 체결되었거나 취소된 주문입니다")

    order.status = CANCELLED
    db.commit()
    db.refresh(order)

    stock = db.query(Stock).filter(Stock.id == order.stock_id).first()
    return {"success": True, "data": _order_dict(order, stock), "message": "주문이 취소되었습니다"}

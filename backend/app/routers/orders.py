from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.account import Account
from app.models.stock import Stock
from app.models.order import Order
from app.models.holding import Holding
from app.schemas.order import OrderRequest, OrderResponse, PortfolioResponse, HoldingResponse

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", status_code=201)
def create_order(
    body: OrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 종목 확인
    stock = db.query(Stock).filter(Stock.id == body.stock_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    # 계좌 확인
    account = db.query(Account).filter(Account.user_id == current_user.id).first()
    if not account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다")

    total_amount = body.price * body.quantity

    if body.order_type == "BUY":
        # 잔고 확인
        if account.balance < total_amount:
            raise HTTPException(status_code=400, detail="잔고가 부족합니다")

        # 잔고 차감
        account.balance -= total_amount

        # 보유 종목 업데이트 (avg_price 갱신)
        holding = db.query(Holding).filter(
            Holding.user_id == current_user.id,
            Holding.stock_id == body.stock_id
        ).first()

        if holding:
            total_qty = holding.quantity + body.quantity
            holding.avg_price = (holding.avg_price * holding.quantity + body.price * body.quantity) // total_qty
            holding.quantity = total_qty
        else:
            holding = Holding(
                user_id=current_user.id,
                stock_id=body.stock_id,
                quantity=body.quantity,
                avg_price=body.price,
            )
            db.add(holding)

    elif body.order_type == "SELL":
        # 보유 수량 확인
        holding = db.query(Holding).filter(
            Holding.user_id == current_user.id,
            Holding.stock_id == body.stock_id
        ).first()

        if not holding or holding.quantity < body.quantity:
            raise HTTPException(status_code=400, detail="보유 수량이 부족합니다")

        # 잔고 증가
        account.balance += total_amount

        # 보유 수량 차감
        holding.quantity -= body.quantity
        if holding.quantity == 0:
            db.delete(holding)

    else:
        raise HTTPException(status_code=400, detail="올바르지 않은 주문 유형입니다 (BUY / SELL)")

    # 주문 기록
    order = Order(
        user_id=current_user.id,
        account_id=account.id,
        stock_id=body.stock_id,
        ai_analysis_id=body.ai_analysis_id,
        order_type=body.order_type,
        quantity=body.quantity,
        price=body.price,
        total_amount=total_amount,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    return {
        "success": True,
        "data": {
            "id": order.id,
            "stock_name": stock.name,
            "order_type": order.order_type,
            "quantity": order.quantity,
            "price": order.price,
            "total_amount": order.total_amount,
            "ordered_at": order.ordered_at,
        },
        "message": "주문이 체결되었습니다"
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
        data.append({
            "id": o.id,
            "stock_name": stock.name if stock else "",
            "stock_code": stock.code if stock else "",
            "order_type": o.order_type,
            "quantity": o.quantity,
            "price": o.price,
            "total_amount": o.total_amount,
            "ordered_at": o.ordered_at,
        })

    return {"success": True, "data": data, "message": "요청 성공"}

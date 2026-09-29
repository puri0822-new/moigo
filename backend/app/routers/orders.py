from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.core.price_cache import get_current_prices
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

    # 체결가는 클라이언트가 보낸 가격이 아니라 서버가 가진 현재가(시세 캐시)를 쓴다.
    # 클라이언트 가격을 믿으면 1원 매수 같은 주문으로 잔고/수익률을 마음대로 조작할 수 있다.
    fill_price = get_current_prices(db, [stock.id], fresh_only=True).get(stock.id)
    if fill_price is None:
        raise HTTPException(status_code=503, detail="현재가를 확인할 수 없어 주문할 수 없습니다. 잠시 후 다시 시도해주세요")

    if body.price_type == "LIMIT":
        # 미체결(대기) 주문은 아직 지원하지 않으므로, 지정가 조건이 지금 충족될 때만 현재가로 즉시 체결한다
        if body.price is None:
            raise HTTPException(status_code=400, detail="지정가 주문은 가격을 입력해야 합니다")
        if body.order_type == "BUY" and fill_price > body.price:
            raise HTTPException(
                status_code=400,
                detail=f"현재가({fill_price:,}원)가 지정가보다 높아 체결되지 않았습니다 (미체결 주문은 아직 지원하지 않습니다)",
            )
        if body.order_type == "SELL" and fill_price < body.price:
            raise HTTPException(
                status_code=400,
                detail=f"현재가({fill_price:,}원)가 지정가보다 낮아 체결되지 않았습니다 (미체결 주문은 아직 지원하지 않습니다)",
            )

    # 계좌 확인 (동시에 들어온 주문이 같은 잔고를 기준으로 계산하지 않도록 행을 잠근다)
    account = db.query(Account).filter(Account.user_id == current_user.id).with_for_update().first()
    if not account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다")

    total_amount = fill_price * body.quantity

    holding = db.query(Holding).filter(
        Holding.user_id == current_user.id,
        Holding.stock_id == body.stock_id
    ).with_for_update().first()

    if body.order_type == "BUY":
        # 잔고 확인
        if account.balance < total_amount:
            raise HTTPException(status_code=400, detail="잔고가 부족합니다")

        # 잔고 차감
        account.balance -= total_amount

        # 보유 종목 업데이트 (avg_price 갱신)
        if holding:
            total_qty = holding.quantity + body.quantity
            holding.avg_price = (holding.avg_price * holding.quantity + fill_price * body.quantity) // total_qty
            holding.quantity = total_qty
        else:
            holding = Holding(
                user_id=current_user.id,
                stock_id=body.stock_id,
                quantity=body.quantity,
                avg_price=fill_price,
            )
            db.add(holding)

    else:  # SELL
        # 보유 수량 확인
        if not holding or holding.quantity < body.quantity:
            raise HTTPException(status_code=400, detail="보유 수량이 부족합니다")

        # 잔고 증가
        account.balance += total_amount

        # 보유 수량 차감
        holding.quantity -= body.quantity
        if holding.quantity == 0:
            db.delete(holding)

    # 주문 기록
    order = Order(
        user_id=current_user.id,
        account_id=account.id,
        stock_id=body.stock_id,
        ai_analysis_id=body.ai_analysis_id,
        order_type=body.order_type,
        quantity=body.quantity,
        price=fill_price,
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

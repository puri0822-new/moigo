from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.core.price_cache import get_current_prices
from app.models.user import User
from app.models.account import Account
from app.models.stock import Stock
from app.models.holding import Holding
from app.models.order import Order

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("")
def get_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = db.query(Account).filter(Account.user_id == current_user.id).first()
    holdings = db.query(Holding).filter(Holding.user_id == current_user.id).all()
    current_prices = get_current_prices(db, [h.stock_id for h in holdings])

    holding_data = []
    total_eval_amount = 0
    total_buy_amount = 0

    for h in holdings:
        stock = db.query(Stock).filter(Stock.id == h.stock_id).first()
        # 시세 캐시에 아직 값이 없으면(서버 기동 직후 등) 평단가로 평가한다
        current_price = current_prices.get(h.stock_id, h.avg_price)
        eval_amount = current_price * h.quantity
        buy_amount = h.avg_price * h.quantity
        profit_loss = eval_amount - buy_amount
        profit_loss_rate = (profit_loss / buy_amount * 100) if buy_amount > 0 else 0.0

        total_eval_amount += eval_amount
        total_buy_amount += buy_amount

        holding_data.append({
            "stock_id": h.stock_id,
            "stock_name": stock.name if stock else "",
            "stock_code": stock.code if stock else "",
            "quantity": h.quantity,
            "avg_price": h.avg_price,
            "current_price": current_price,
            "eval_amount": eval_amount,
            "profit_loss": profit_loss,
            "profit_loss_rate": round(profit_loss_rate, 2),
        })

    total_profit_loss = total_eval_amount - total_buy_amount
    total_profit_loss_rate = (total_profit_loss / total_buy_amount * 100) if total_buy_amount > 0 else 0.0

    return {
        "success": True,
        "data": {
            "balance": account.balance if account else 0,
            "total_eval_amount": total_eval_amount,
            "total_profit_loss": total_profit_loss,
            "total_profit_loss_rate": round(total_profit_loss_rate, 2),
            "holdings": holding_data,
        },
        "message": "요청 성공"
    }


@router.get("/history")
def get_history(
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

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.account import Account
from app.models.holding import Holding
from app.core.price_cache import get_current_prices

router = APIRouter(prefix="/account", tags=["account"])


@router.get("")
def get_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = db.query(Account).filter(Account.user_id == current_user.id).first()

    # 수익은 현금만이 아니라 보유 주식의 현재 평가액까지 합친 총자산 기준으로 계산한다
    # (현금만 보면 주식을 사는 순간 그만큼 손실로 잡힌다)
    holdings = db.query(Holding).filter(Holding.user_id == current_user.id).all()
    current_prices = get_current_prices(db, [h.stock_id for h in holdings])
    holdings_value = sum(current_prices.get(h.stock_id, h.avg_price) * h.quantity for h in holdings)

    profit_loss = account.balance + holdings_value - account.initial_balance
    profit_loss_rate = round(profit_loss / account.initial_balance * 100, 2)

    return {
        "success": True,
        "data": {
            "id": account.id,
            "balance": account.balance,
            "initial_balance": account.initial_balance,
            "total_profit_loss": profit_loss,
            "profit_loss_rate": profit_loss_rate,
        },
        "message": "요청 성공"
    }

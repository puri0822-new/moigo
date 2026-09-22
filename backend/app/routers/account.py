from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.account import Account

router = APIRouter(prefix="/account", tags=["account"])


@router.get("")
def get_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = db.query(Account).filter(Account.user_id == current_user.id).first()

    profit_loss = account.balance - account.initial_balance
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

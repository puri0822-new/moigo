import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core import toss_client
from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.account import Account
from app.models.holding import Holding
from app.models.stock import Stock
from app.models.user import User

router = APIRouter(prefix="/ranking", tags=["ranking"])

TOP_HOLDINGS = 3


@router.get("")
async def get_ranking(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    accounts = db.query(User, Account).join(Account, Account.user_id == User.id).all()
    holdings = db.query(Holding, Stock).join(Stock, Stock.id == Holding.stock_id).all()

    codes = sorted({stock.code for _, stock in holdings})
    try:
        prices = await toss_client.get_prices(codes) if codes else {}
    except httpx.HTTPError:
        prices = {}

    by_user: dict[int, list[dict]] = {}
    for h, stock in holdings:
        price_data = prices.get(stock.code)
        # 현재가를 못 받으면 평균 매수가로 평가해 손익 0으로 본다
        current_price = int(float(price_data["lastPrice"])) if price_data else h.avg_price
        buy_amount = h.avg_price * h.quantity
        eval_amount = current_price * h.quantity
        by_user.setdefault(h.user_id, []).append({
            "name": stock.name,
            "code": stock.code,
            "eval_amount": eval_amount,
            "profit_rate": round((eval_amount - buy_amount) / buy_amount * 100, 2) if buy_amount > 0 else 0.0,
        })

    rows = []
    for user, account in accounts:
        user_holdings = sorted(by_user.get(user.id, []), key=lambda x: x["eval_amount"], reverse=True)
        total_asset = account.balance + sum(x["eval_amount"] for x in user_holdings)
        profit_amount = total_asset - account.initial_balance
        rows.append({
            "user_id": user.id,
            "nickname": user.nickname,
            "total_asset": total_asset,
            "profit_amount": profit_amount,
            "profit_rate": round(profit_amount / account.initial_balance * 100, 2) if account.initial_balance > 0 else 0.0,
            "top_holdings": [
                {"name": x["name"], "code": x["code"], "profit_rate": x["profit_rate"]}
                for x in user_holdings[:TOP_HOLDINGS]
            ],
            "is_me": user.id == current_user.id,
        })

    # 총 자산이 같으면 먼저 가입한 사용자가 위
    rows.sort(key=lambda r: (-r["total_asset"], r["user_id"]))
    data = [{"rank": i + 1, **r} for i, r in enumerate(rows)]

    return {"success": True, "data": data, "message": "요청 성공"}

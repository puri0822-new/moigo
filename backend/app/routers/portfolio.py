import asyncio

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.core import toss_client
from app.models.user import User
from app.models.account import Account
from app.models.stock import Stock
from app.models.holding import Holding
from app.models.order import Order

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("")
async def get_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = db.query(Account).filter(Account.user_id == current_user.id).first()
    holdings = db.query(Holding).filter(Holding.user_id == current_user.id).all()

    codes = []
    stock_map: dict[int, Stock] = {}
    for h in holdings:
        stock = db.query(Stock).filter(Stock.id == h.stock_id).first()
        if stock:
            stock_map[h.stock_id] = stock
            codes.append(stock.code)

    try:
        prices = await toss_client.get_prices(codes) if codes else {}
    except httpx.HTTPError:
        prices = {}

    holding_data = []
    total_eval_amount = 0

    for h in holdings:
        stock = stock_map.get(h.stock_id)
        price_data = prices.get(stock.code) if stock else None
        current_price = int(float(price_data["lastPrice"])) if price_data else h.avg_price

        eval_amount = current_price * h.quantity
        buy_amount = h.avg_price * h.quantity
        profit_loss = eval_amount - buy_amount
        profit_loss_rate = (profit_loss / buy_amount * 100) if buy_amount > 0 else 0.0

        total_eval_amount += eval_amount

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

    # 합계 수익은 실현 손익까지 포함하도록 초기 자금 대비로 계산한다 (랭킹과 같은 기준)
    balance = account.balance if account else 0
    initial_balance = account.initial_balance if account else 0
    total_profit_loss = balance + total_eval_amount - initial_balance
    total_profit_loss_rate = (total_profit_loss / initial_balance * 100) if initial_balance > 0 else 0.0

    return {
        "success": True,
        "data": {
            "balance": balance,
            "total_eval_amount": total_eval_amount,
            "total_profit_loss": total_profit_loss,
            "total_profit_loss_rate": round(total_profit_loss_rate, 2),
            "holdings": holding_data,
        },
        "message": "요청 성공"
    }


def _realized_pnl(orders: list[Order]) -> dict[int, tuple[int, int, float]]:
    """매도 주문마다 (그때 평균 매수가, 실현 손익, 수익률%)를 구한다.
    주문에는 평균 매수가가 저장돼 있지 않아서, 주문 처리(orders.py)와 같은 방식으로 오래된 주문부터 다시 계산한다:
    매수하면 평균 매수가를 가중 평균(원 아래 버림)으로 바꾸고, 매도는 수량만 줄이며, 다 팔면 처음부터 다시 쌓는다."""
    position: dict[int, tuple[int, int]] = {}  # stock_id → (수량, 평균 매수가)
    result: dict[int, tuple[int, int, float]] = {}
    for o in sorted(orders, key=lambda o: (o.ordered_at, o.id)):
        qty, avg = position.get(o.stock_id, (0, 0))
        if o.order_type == "BUY":
            total = qty + o.quantity
            avg = (avg * qty + o.price * o.quantity) // total
            position[o.stock_id] = (total, avg)
        elif o.order_type == "SELL":
            # 기록상 산 적이 없는 매도(초기화 전 데이터 등)는 계산하지 않는다
            if qty > 0 and avg > 0:
                result[o.id] = (avg, (o.price - avg) * o.quantity, (o.price - avg) / avg * 100)
            left = qty - o.quantity
            position[o.stock_id] = (left, avg) if left > 0 else (0, 0)
    return result


@router.get("/history")
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    orders = db.query(Order).filter(
        Order.user_id == current_user.id
    ).order_by(Order.ordered_at.desc()).all()
    stocks = {s.id: s for s in db.query(Stock).filter(Stock.id.in_({o.stock_id for o in orders})).all()} if orders else {}
    realized = _realized_pnl(orders)

    data = []
    for o in orders:
        stock = stocks.get(o.stock_id)
        pnl = realized.get(o.id)
        data.append({
            "id": o.id,
            "stock_name": stock.name if stock else "",
            "stock_code": stock.code if stock else "",
            "order_type": o.order_type,
            "quantity": o.quantity,
            "price": o.price,
            "total_amount": o.total_amount,
            "ordered_at": o.ordered_at,
            # 매도에만 있다 (매수·계산 불가면 None)
            "avg_buy_price": pnl[0] if pnl else None,
            "realized_profit": pnl[1] if pnl else None,
            "realized_profit_rate": round(pnl[2], 2) if pnl else None,
        })

    return {"success": True, "data": data, "message": "요청 성공"}

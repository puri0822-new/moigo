from bisect import bisect_right
from datetime import date, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.candle_store import get_daily_bars
from app.core.dependencies import get_current_user
from app.core.market_hours import KST, now_kst
from app.core.order_matching import FILLED, reserved_cash, reserved_shares
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
    # 미체결 주문에 묶인 금액·수량을 뺀 만큼만 새로 주문할 수 있다
    pending_cash = reserved_cash(db, current_user.id)
    pending_shares = reserved_shares(db, current_user.id)

    holding_data = []
    total_eval_amount = 0

    for h in holdings:
        stock = db.query(Stock).filter(Stock.id == h.stock_id).first()
        # 시세 캐시에 아직 값이 없으면(서버 기동 직후 등) 평단가로 평가한다
        current_price = current_prices.get(h.stock_id, h.avg_price)
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
            "orderable_quantity": max(0, h.quantity - pending_shares.get(h.stock_id, 0)),
            "avg_price": h.avg_price,
            "current_price": current_price,
            "eval_amount": eval_amount,
            "profit_loss": profit_loss,
            "profit_loss_rate": round(profit_loss_rate, 2),
        })

    # 합계 수익은 실현 손익까지 포함하도록 초기 자금 대비로 계산한다 (랭킹과 같은 기준)
    initial_balance = account.initial_balance if account else 0
    total_profit_loss = (account.balance if account else 0) + total_eval_amount - initial_balance
    total_profit_loss_rate = (total_profit_loss / initial_balance * 100) if initial_balance > 0 else 0.0

    return {
        "success": True,
        "data": {
            "balance": account.balance if account else 0,
            "orderable_balance": max(0, account.balance - pending_cash) if account else 0,
            "total_eval_amount": total_eval_amount,
            "total_profit_loss": total_profit_loss,
            "total_profit_loss_rate": round(total_profit_loss_rate, 2),
            "holdings": holding_data,
        },
        "message": "요청 성공"
    }


def _kst_date(value) -> date:
    # DB 컬럼은 timestamptz지만 모델에 시간대가 없는 타입으로 선언된 것도 있어, 시간대가 없으면 UTC로 본다
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(KST).date()


@router.get("/asset-history")
async def get_asset_history(
    days: int = Query(default=90, ge=7, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """최근 days일의 일별 총자산(현금 + 보유 주식 평가액) 추이.
    따로 쌓아 둔 기록 없이, 지금의 잔고·보유 수량에서 체결 내역을 날짜 역순으로 되돌려 그날의 현금과 수량을 구하고
    그날 종가(일봉)로 평가한다. 장이 없는 날은 직전 거래일 종가를 쓰고, 오늘은 현재가를 쓴다."""
    account = db.query(Account).filter(Account.user_id == current_user.id).first()
    if not account:
        return {"success": True, "data": {"initial_balance": 0, "points": []}, "message": "요청 성공"}

    today = now_kst().date()
    # 계좌를 만들기 전 날짜는 보여줄 것이 없다
    start = max(today - timedelta(days=days - 1), _kst_date(account.created_at))

    holdings = db.query(Holding).filter(Holding.user_id == current_user.id).all()
    orders = db.query(Order).filter(Order.user_id == current_user.id, Order.status == FILLED).all()
    # 최근 체결부터 되돌린다
    fills = sorted(((_kst_date(o.filled_at or o.ordered_at), o) for o in orders), key=lambda f: f[0], reverse=True)

    quantities = {h.stock_id: h.quantity for h in holdings}
    stock_ids = set(quantities) | {o.stock_id for o in orders}
    current_prices = get_current_prices(db, list(stock_ids))

    # 종목별 (날짜 목록, 종가 목록). 달력 일수만큼 받으면 거래일 기준으로는 항상 충분하다
    closes: dict[int, tuple[list[date], list[int]]] = {}
    for stock in db.query(Stock).filter(Stock.id.in_(stock_ids)).all() if stock_ids else []:
        bars = await get_daily_bars(db, stock, (today - start).days + 10)
        closes[stock.id] = ([date.fromisoformat(b["timestamp"][:10]) for b in bars], [int(b["closePrice"]) for b in bars])

    def price_on(stock_id: int, day: date) -> int:
        if day == today and stock_id in current_prices:
            return current_prices[stock_id]
        dates, prices = closes.get(stock_id, ([], []))
        if not dates:
            return current_prices.get(stock_id, 0)
        # 그날 또는 그 전 마지막 거래일의 종가 (그보다 앞선 봉이 없으면 가장 오래된 봉)
        return prices[max(bisect_right(dates, day) - 1, 0)]

    cash = account.balance
    points = []
    next_fill = 0
    day = today
    while day >= start:
        # 이 날짜보다 뒤에 체결된 주문을 되돌려 이 날짜 장 마감 시점의 현금·수량으로 만든다
        while next_fill < len(fills) and fills[next_fill][0] > day:
            order = fills[next_fill][1]
            sign = 1 if order.order_type == "BUY" else -1
            cash += sign * order.total_amount
            quantities[order.stock_id] = quantities.get(order.stock_id, 0) - sign * order.quantity
            next_fill += 1
        stock_value = sum(qty * price_on(stock_id, day) for stock_id, qty in quantities.items() if qty > 0)
        points.append({"date": day.isoformat(), "total_asset": cash + stock_value, "cash": cash, "stock_value": stock_value})
        day -= timedelta(days=1)
    points.reverse()

    return {
        "success": True,
        "data": {"initial_balance": account.initial_balance, "points": points},
        "message": "요청 성공"
    }


def _realized_pnl(orders: list[Order]) -> dict[int, tuple[int, int, float]]:
    """매도 주문마다 (그때 평균 매수가, 실현 손익, 수익률%)를 구한다.
    주문에는 평균 매수가가 저장돼 있지 않아서, 주문 처리(orders.py)와 같은 방식으로 오래된 주문부터 다시 계산한다:
    매수하면 평균 매수가를 가중 평균(원 아래 버림)으로 바꾸고, 매도는 수량만 줄이며, 다 팔면 처음부터 다시 쌓는다."""
    position: dict[int, tuple[int, int]] = {}  # stock_id → (수량, 평균 매수가)
    result: dict[int, tuple[int, int, float]] = {}
    # 지정가 주문은 접수와 체결 시각이 다를 수 있어 체결 순서대로 계산한다
    for o in sorted(orders, key=lambda o: (o.filled_at or o.ordered_at, o.id)):
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
    # 거래 내역에는 실제로 체결된 주문만 보여준다 (미체결·취소·만료 주문은 GET /orders에서 본다)
    orders = db.query(Order).filter(
        Order.user_id == current_user.id,
        Order.status == FILLED
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

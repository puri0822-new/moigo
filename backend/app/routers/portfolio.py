import asyncio
from bisect import bisect_right
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.core import candle_store, toss_client
from app.core.database import SessionLocal as AsyncSessionLocal
from app.core.order_matching import reserved_cash, reserved_shares
from app.models.user import User
from app.models.account import Account
from app.models.stock import Stock
from app.models.holding import Holding
from app.models.order import Order

router = APIRouter(prefix="/portfolio", tags=["portfolio"])
KST = ZoneInfo("Asia/Seoul")


@router.get("")
async def get_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = db.query(Account).filter(Account.user_id == current_user.id).first()
    holdings = db.query(Holding).filter(Holding.user_id == current_user.id).all()
    pending_shares = reserved_shares(db, current_user.id)
    # 매수 예약금은 이미 balance에서 빠져 있다. 화면에 "예약 중"으로만 보여 준다.
    pending_cash = reserved_cash(db, current_user.id) if account else 0

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
            "orderable_quantity": max(0, h.quantity - pending_shares.get(h.stock_id, 0)),
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
            # 예약금은 이미 차감됨 → 주문가능 = 잔고. reserved_cash는 예약 중 금액 표시용
            "orderable_balance": balance,
            "reserved_cash": pending_cash,
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
    current_user: User = Depends(get_current_user),
):
    """최근 days일의 일별 총자산(현금 + 보유 주식 평가액) 추이.
    따로 쌓아 둔 기록 없이, 지금의 잔고·보유 수량에서 체결 내역을 날짜 역순으로 되돌려 그날의 현금과 수량을 구하고
    그날 종가(일봉)로 평가한다. 장이 없는 날은 직전 거래일 종가를 쓰고, 오늘은 현재가를 쓴다."""
    account = db.query(Account).filter(Account.user_id == current_user.id).first()
    if not account:
        return {"success": True, "data": {"initial_balance": 0, "points": []}, "message": "요청 성공"}

    holdings = db.query(Holding).filter(Holding.user_id == current_user.id).all()
    # 체결된 수량만큼만 되돌린다 (미체결·취소는 잔고에 아직 반영되지 않음)
    orders = db.query(Order).filter(Order.user_id == current_user.id, Order.filled_quantity > 0).all()
    stock_ids = {h.stock_id for h in holdings} | {o.stock_id for o in orders}
    stocks = [(s.id, s.code) for s in db.query(Stock).filter(Stock.id.in_(stock_ids)).all()] if stock_ids else []

    codes = [code for _, code in stocks]
    try:
        prices = await toss_client.get_prices(codes) if codes else {}
    except httpx.HTTPError:
        prices = {}
    current_prices = {
        stock_id: int(float(prices[code]["lastPrice"]))
        for stock_id, code in stocks
        if code in prices
    }

    today = datetime.now(KST).date()
    start = max(today - timedelta(days=days - 1), _kst_date(account.created_at))
    need = (today - start).days + 10

    fills = sorted(
        ((_kst_date(o.filled_at or o.ordered_at), o) for o in orders),
        key=lambda f: f[0],
        reverse=True,
    )
    quantities = {h.stock_id: h.quantity for h in holdings}

    closes: dict[int, tuple[list[date], list[int]]] = {}
    async with AsyncSessionLocal() as adb:
        for stock_id, _code in stocks:
            stock = (await adb.execute(select(Stock).where(Stock.id == stock_id))).scalar_one_or_none()
            if not stock:
                continue
            bars = await candle_store.get_daily_bars(adb, stock, need)
            closes[stock_id] = (
                [date.fromisoformat(b["timestamp"][:10]) for b in bars],
                [int(b["closePrice"]) for b in bars],
            )

    def price_on(stock_id: int, day: date) -> int:
        if day == today and stock_id in current_prices:
            return current_prices[stock_id]
        dates, prices_list = closes.get(stock_id, ([], []))
        if not dates:
            return current_prices.get(stock_id, 0)
        return prices_list[max(bisect_right(dates, day) - 1, 0)]

    cash = account.balance
    points = []
    next_fill = 0
    day = today
    while day >= start:
        while next_fill < len(fills) and fills[next_fill][0] > day:
            order = fills[next_fill][1]
            sign = 1 if order.order_type == "BUY" else -1
            cash += sign * order.filled_amount
            quantities[order.stock_id] = quantities.get(order.stock_id, 0) - sign * order.filled_quantity
            next_fill += 1
        stock_value = sum(qty * price_on(stock_id, day) for stock_id, qty in quantities.items() if qty > 0)
        points.append({"date": day.isoformat(), "total_asset": cash + stock_value, "cash": cash, "stock_value": stock_value})
        day -= timedelta(days=1)
    points.reverse()

    return {
        "success": True,
        "data": {"initial_balance": account.initial_balance, "points": points},
        "message": "요청 성공",
    }


def _realized_pnl(orders: list[Order]) -> dict[int, tuple[int, int, float]]:
    """매도 주문마다 (그때 평균 매수가, 실현 손익, 수익률%)를 구한다.
    주문에는 평균 매수가가 저장돼 있지 않아서, 주문 처리(orders.py)와 같은 방식으로 오래된 주문부터 다시 계산한다:
    매수하면 평균 매수가를 가중 평균(원 아래 버림)으로 바꾸고, 매도는 수량만 줄이며, 다 팔면 처음부터 다시 쌓는다."""
    position: dict[int, tuple[int, int]] = {}  # stock_id → (수량, 평균 매수가)
    result: dict[int, tuple[int, int, float]] = {}
    for o in sorted(orders, key=lambda o: (o.ordered_at, o.id)):
        fill_qty = o.filled_quantity or 0
        if fill_qty <= 0:
            continue
        qty, avg = position.get(o.stock_id, (0, 0))
        if o.order_type == "BUY":
            total = qty + fill_qty
            avg = (avg * qty + o.price * fill_qty) // total
            position[o.stock_id] = (total, avg)
        elif o.order_type == "SELL":
            if qty > 0 and avg > 0:
                result[o.id] = (avg, (o.price - avg) * fill_qty, (o.price - avg) / avg * 100)
            left = qty - fill_qty
            position[o.stock_id] = (left, avg) if left > 0 else (0, 0)
    return result


@router.get("/history")
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 체결된 수량이 있는 주문만 거래 내역에 보여준다 (순수 미체결은 주문 목록에서 본다)
    orders = db.query(Order).filter(
        Order.user_id == current_user.id,
        Order.filled_quantity > 0,
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
            "status": o.status,
            "quantity": o.filled_quantity,
            "price": o.price,
            "total_amount": o.filled_amount,
            "ordered_at": o.ordered_at,
            "avg_buy_price": pnl[0] if pnl else None,
            "realized_profit": pnl[1] if pnl else None,
            "realized_profit_rate": round(pnl[2], 2) if pnl else None,
        })

    return {"success": True, "data": data, "message": "요청 성공"}

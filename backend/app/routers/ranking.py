import asyncio
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import toss_client
from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.account import Account
from app.models.holding import Holding
from app.models.order import Order
from app.models.stock import Stock
from app.models.user import User

router = APIRouter(prefix="/ranking", tags=["ranking"])

TOP_HOLDINGS = 3
WEEK_DAYS = 7
KST = timezone(timedelta(hours=9))


async def _current_prices(codes: list[str]) -> dict[str, int]:
    try:
        prices = await toss_client.get_prices(codes) if codes else {}
    except httpx.HTTPError:
        prices = {}
    return {code: int(float(p["lastPrice"])) for code, p in prices.items()}


@router.get("")
async def get_ranking(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    accounts = db.query(User, Account).join(Account, Account.user_id == User.id).all()
    holdings = db.query(Holding, Stock).join(Stock, Stock.id == Holding.stock_id).all()
    prices = await _current_prices(sorted({stock.code for _, stock in holdings}))

    by_user: dict[int, list[dict]] = {}
    for h, stock in holdings:
        # 현재가를 못 받으면 평균 매수가로 평가해 손익 0으로 본다
        current_price = prices.get(stock.code, h.avg_price)
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


async def _closes_on(codes: list[str], day: str) -> dict[str, int]:
    """day(YYYY-MM-DD) 또는 그 이전 가장 가까운 거래일의 종가."""

    async def one(code: str) -> tuple[str, int | None]:
        try:
            candles = await toss_client.get_candles(code, "1d", 20)
        except httpx.HTTPError:
            return code, None
        past = [c for c in candles if c["timestamp"][:10] <= day]
        return code, int(float(past[-1]["closePrice"])) if past else None

    results = await asyncio.gather(*(one(code) for code in codes))
    return {code: close for code, close in results if close is not None}


@router.get("/weekly")
async def get_weekly_ranking(
    limit: int = Query(default=5, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """최근 7일 동안 번 금액 순위. 자산 기록을 따로 쌓지 않으므로, 최근 7일 주문을 되돌려
    7일 전의 현금·보유 수량을 구하고 당시 종가로 평가한 총 자산과 지금을 비교한다."""
    accounts = db.query(User, Account).join(Account, Account.user_id == User.id).all()
    holdings = db.query(Holding).all()
    recent_orders = db.query(Order).filter(text(f"ordered_at >= now() - interval '{WEEK_DAYS} days'")).all()
    stocks = {s.id: s for s in db.query(Stock).all()}

    qty_now: dict[tuple[int, int], int] = {(h.user_id, h.stock_id): h.quantity for h in holdings}
    qty_then = dict(qty_now)
    cash_delta: dict[int, int] = {}  # 7일 전 현금 = 지금 현금 + cash_delta
    for o in recent_orders:
        sign = 1 if o.order_type == "BUY" else -1
        key = (o.user_id, o.stock_id)
        qty_then[key] = qty_then.get(key, 0) - sign * o.quantity
        cash_delta[o.user_id] = cash_delta.get(o.user_id, 0) + sign * o.total_amount

    stock_ids = {stock_id for (_, stock_id), qty in (*qty_now.items(), *qty_then.items()) if qty > 0}
    codes = sorted(stocks[i].code for i in stock_ids)
    base_day = (datetime.now(KST) - timedelta(days=WEEK_DAYS)).date().isoformat()
    prices_now, prices_then = await asyncio.gather(_current_prices(codes), _closes_on(codes, base_day))

    def evaluate(quantities: dict[tuple[int, int], int], user_id: int, prices: dict[str, int]) -> int | None:
        total = 0
        for (uid, stock_id), qty in quantities.items():
            if uid != user_id or qty <= 0:
                continue
            price = prices.get(stocks[stock_id].code)
            if price is None:
                return None
            total += price * qty
        return total

    rows = []
    for user, account in accounts:
        eval_now = evaluate(qty_now, user.id, prices_now)
        eval_then = evaluate(qty_then, user.id, prices_then)
        # 시세를 못 받은 종목이 있으면 그 사용자의 이번 주 수익은 0으로 둔다 (틀린 숫자를 보여주지 않게)
        if eval_now is None or eval_then is None:
            asset_now = asset_then = account.balance
        else:
            asset_now = account.balance + eval_now
            asset_then = account.balance + cash_delta.get(user.id, 0) + eval_then
        profit = asset_now - asset_then
        rows.append({
            "user_id": user.id,
            "nickname": user.nickname,
            "profit_amount": profit,
            "profit_rate": round(profit / asset_then * 100, 2) if asset_then > 0 else 0.0,
            "is_me": user.id == current_user.id,
        })

    rows.sort(key=lambda r: (-r["profit_amount"], r["user_id"]))
    data = [{"rank": i + 1, **r} for i, r in enumerate(rows)][:limit]

    return {"success": True, "data": data, "message": "요청 성공"}

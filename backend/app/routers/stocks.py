import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import toss_client
from app.core.database import get_db
from app.models import Stock
from app.schemas.common import ApiResponse
from app.schemas.stock import StockDetail, StockListItem

router = APIRouter(prefix="/stocks", tags=["Stocks"])


async def _fetch_prices_safe(codes: list[str]) -> dict[str, dict]:
    try:
        return await toss_client.get_prices(codes)
    except httpx.HTTPError:
        # 토스 API 장애 시에도 종목 목록 자체는 내려주고, 시세만 null로 둔다
        return {}


@router.get("", response_model=ApiResponse[list[StockListItem]])
async def list_stocks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Stock).order_by(Stock.id))
    stocks = result.scalars().all()

    prices = await _fetch_prices_safe([s.code for s in stocks])

    data = []
    for s in stocks:
        item = StockListItem.model_validate(s)
        price = prices.get(s.code)
        if price:
            item.current_price = int(float(price["lastPrice"]))
        data.append(item)

    return ApiResponse(success=True, data=data, message="요청 성공")


@router.get("/{stock_id}", response_model=ApiResponse[StockDetail])
async def get_stock(stock_id: int, db: AsyncSession = Depends(get_db)):
    stock = await db.get(Stock, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    detail = StockDetail.model_validate(stock)
    prices = await _fetch_prices_safe([stock.code])
    price = prices.get(stock.code)
    if price:
        detail.current_price = int(float(price["lastPrice"]))

    return ApiResponse(success=True, data=detail, message="요청 성공")

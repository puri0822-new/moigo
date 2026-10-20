import asyncio
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import naver_client, toss_client
from app.core.candle_agg import aggregate_daily
from app.core.candle_store import get_daily_bars
from app.core.database import get_db
from app.models import Stock
from app.schemas.candle import Candle
from app.schemas.common import ApiResponse
from app.schemas.news import NewsItem
from app.schemas.orderbook import Orderbook, OrderbookLevel
from app.schemas.stock import StockDetail, StockListItem

router = APIRouter(prefix="/stocks", tags=["Stocks"])
logger = logging.getLogger(__name__)

TOSS_TIMEOUT_SECONDS = 6
# 일봉은 DB에서 읽고, 주/월/년봉은 그 일봉을 묶어서 만든다.
_TRADING_DAYS_PER_BAR = {"1d": 1, "1w": 5, "1mo": 22, "1y": 250}
_MAX_DAILY_HISTORY = 2500
_MAX_BAR_COUNT = 2000


async def _fetch_prices_safe(codes: list[str]) -> dict[str, dict]:
    try:
        return await toss_client.get_prices(codes)
    except httpx.HTTPError:
        return {}


async def _fetch_prev_closes_safe(codes: list[str]) -> dict[str, float]:
    """등락률 계산용 전일 종가. 일봉 2개(전일/당일)를 조회해 앞쪽(전일)의 종가를 사용."""

    async def fetch_one(code: str) -> tuple[str, float | None]:
        try:
            candles = await toss_client.get_candles(code, "1d", 2)
        except httpx.HTTPError:
            return code, None
        if len(candles) < 2:
            return code, None
        return code, float(candles[-2]["closePrice"])

    results = await asyncio.gather(*[fetch_one(c) for c in codes])
    return {code: close for code, close in results if close is not None}


def _apply_change_rate(item: StockListItem, prev_close: float | None) -> None:
    if item.current_price is not None and prev_close:
        item.change_rate = (item.current_price - prev_close) / prev_close


@router.get("", response_model=ApiResponse[list[StockListItem]])
async def list_stocks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Stock).order_by(Stock.id))
    stocks = result.scalars().all()
    codes = [s.code for s in stocks]

    prices, prev_closes = await asyncio.gather(
        _fetch_prices_safe(codes),
        _fetch_prev_closes_safe(codes),
    )

    vol_rows = await db.execute(text(
        "SELECT DISTINCT ON (stock_id) stock_id, volume "
        "FROM stock_daily_candles ORDER BY stock_id, trade_date DESC"
    ))
    volumes = {row.stock_id: row.volume for row in vol_rows}

    data = []
    for s in stocks:
        item = StockListItem.model_validate(s)
        price = prices.get(s.code)
        if price:
            item.current_price = int(float(price["lastPrice"]))
        _apply_change_rate(item, prev_closes.get(s.code))
        item.volume = volumes.get(s.id)
        data.append(item)

    return ApiResponse(success=True, data=data, message="요청 성공")


async def _build_stock_detail(stock: Stock, db: AsyncSession) -> StockDetail:
    detail = StockDetail.model_validate(stock)

    vol = await db.execute(
        text("SELECT volume FROM stock_daily_candles WHERE stock_id = :id ORDER BY trade_date DESC LIMIT 1"),
        {"id": stock.id},
    )
    detail.volume = vol.scalar_one_or_none()

    prices = await _fetch_prices_safe([stock.code])
    price = prices.get(stock.code)
    if price:
        detail.current_price = int(float(price["lastPrice"]))

    prev_closes = await _fetch_prev_closes_safe([stock.code])
    _apply_change_rate(detail, prev_closes.get(stock.code))

    return detail


@router.get("/by-code/{code}", response_model=ApiResponse[StockDetail])
async def get_stock_by_code(code: str, db: AsyncSession = Depends(get_db)):
    """종목 코드로 단건 조회. 상세페이지에서 종목 하나만 필요할 때 30종목 전체를 도는
    GET /stocks를 호출하지 않도록 별도로 둔다 (그러면 시세+등락률 계산 때문에 훨씬 느려짐)."""
    result = await db.execute(select(Stock).where(Stock.code == code))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    return ApiResponse(success=True, data=await _build_stock_detail(stock, db), message="요청 성공")


@router.get("/{stock_id}", response_model=ApiResponse[StockDetail])
async def get_stock(stock_id: int, db: AsyncSession = Depends(get_db)):
    stock = await db.get(Stock, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    return ApiResponse(success=True, data=await _build_stock_detail(stock, db), message="요청 성공")


@router.get("/{stock_id}/candles", response_model=ApiResponse[list[Candle]])
async def get_stock_candles(
    stock_id: int,
    interval: str = "1d",
    count: int = 100,
    db: AsyncSession = Depends(get_db),
):
    if interval != "1m" and interval not in _TRADING_DAYS_PER_BAR:
        raise HTTPException(status_code=400, detail="interval은 1m, 1d, 1w, 1mo, 1y만 지원합니다")
    if not 1 <= count <= _MAX_BAR_COUNT:
        raise HTTPException(status_code=400, detail=f"count는 1~{_MAX_BAR_COUNT} 사이여야 합니다")
    daily_needed = min(
        _MAX_DAILY_HISTORY,
        count if interval == "1d" else (count + 1) * _TRADING_DAYS_PER_BAR.get(interval, 0),
    )

    stock = await db.get(Stock, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    try:
        if interval == "1m":
            raw_candles = await asyncio.wait_for(
                toss_client.get_candles(stock.code, interval, count), TOSS_TIMEOUT_SECONDS
            )
        else:
            daily = await get_daily_bars(db, stock, daily_needed)
            raw_candles = daily[-count:] if interval == "1d" else aggregate_daily(daily, interval)[-count:]
    except (httpx.HTTPError, asyncio.TimeoutError) as e:
        logger.warning("캔들 조회 실패 %s %s/%d: %r", stock.code, interval, count, e)
        raise HTTPException(status_code=502, detail="차트 데이터를 불러오지 못했습니다")

    data = [
        Candle(
            timestamp=c["timestamp"],
            open=float(c["openPrice"]),
            high=float(c["highPrice"]),
            low=float(c["lowPrice"]),
            close=float(c["closePrice"]),
            volume=float(c["volume"]),
        )
        for c in raw_candles
    ]
    return ApiResponse(success=True, data=data, message="요청 성공")


@router.get("/{stock_id}/orderbook", response_model=ApiResponse[Orderbook])
async def get_stock_orderbook(stock_id: int, db: AsyncSession = Depends(get_db)):
    stock = await db.get(Stock, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    try:
        raw = await asyncio.wait_for(toss_client.get_orderbook(stock.code), TOSS_TIMEOUT_SECONDS)
    except (httpx.HTTPError, asyncio.TimeoutError) as e:
        logger.warning("호가 조회 실패 %s: %r", stock.code, e)
        raise HTTPException(status_code=502, detail="호가를 불러오지 못했습니다")

    def levels(side: str) -> list[OrderbookLevel]:
        return [OrderbookLevel(price=int(float(l["price"])), volume=int(float(l["volume"]))) for l in raw.get(side, [])]

    data = Orderbook(timestamp=raw["timestamp"], asks=levels("asks"), bids=levels("bids"))
    return ApiResponse(success=True, data=data, message="요청 성공")


@router.get("/{stock_id}/info", response_model=ApiResponse[dict])
async def get_stock_info(stock_id: int, db: AsyncSession = Depends(get_db)):
    stock = await db.get(Stock, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    try:
        raw = await toss_client.get_stock_info(stock.code)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="종목 정보를 불러오지 못했습니다")
    if not raw:
        raise HTTPException(status_code=404, detail="종목 정보를 찾을 수 없습니다")

    korean = raw.get("koreanMarketDetail") or {}
    shares = raw.get("sharesOutstanding")
    data = {
        "english_name": raw.get("englishName"),
        "isin_code": raw.get("isinCode"),
        "market": raw.get("market"),
        "security_type": raw.get("securityType"),
        "is_common_share": raw.get("isCommonShare"),
        "status": raw.get("status"),
        "currency": raw.get("currency"),
        "list_date": raw.get("listDate"),
        "shares_outstanding": int(float(shares)) if shares is not None else None,
        "nxt_supported": korean.get("nxtSupported"),
        "trading_suspended": korean.get("krxTradingSuspended"),
    }
    return ApiResponse(success=True, data=data, message="요청 성공")


@router.get("/{stock_id}/news", response_model=ApiResponse[list[NewsItem]])
async def get_stock_news(stock_id: int, limit: int = 10, db: AsyncSession = Depends(get_db)):
    stock = await db.get(Stock, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    try:
        items = await asyncio.wait_for(naver_client.search_news(stock.name, display=limit), TOSS_TIMEOUT_SECONDS)
    except (httpx.HTTPError, asyncio.TimeoutError):
        items = []

    data = [NewsItem(id=i + 1, **item) for i, item in enumerate(items)]
    return ApiResponse(success=True, data=data, message="요청 성공")

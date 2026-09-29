import asyncio

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import toss_client
from app.core.database import get_db
from app.models import Stock
from app.schemas.candle import Candle
from app.schemas.common import ApiResponse
from app.schemas.ranking import StockRankingItem
from app.schemas.stock import StockDetail, StockListItem

router = APIRouter(prefix="/stocks", tags=["Stocks"])


async def _fetch_prices_safe(codes: list[str]) -> dict[str, dict]:
    try:
        return await toss_client.get_prices(codes)
    except httpx.HTTPError:
        # 토스 API 장애 시에도 종목 목록 자체는 내려주고, 시세만 null로 둔다
        return {}


# 캔들 API 레이트리밋(초당 20건)보다 여유있게 낮춰서, 폴백 대상 종목이 늘어나도
# 동시 호출량이 절대 한도를 넘지 않도록 한다.
_CANDLE_CONCURRENCY = asyncio.Semaphore(15)


async def _fetch_candle_info_safe(codes: list[str]) -> dict[str, dict]:
    """등락률/거래량 계산용 보조 데이터. 일봉 2개(전일/당일)를 조회해
    전일 종가(prev_close)와 당일 거래량(volume)을 함께 반환."""

    async def fetch_one(code: str) -> tuple[str, dict | None]:
        async with _CANDLE_CONCURRENCY:
            try:
                candles = await toss_client.get_candles(code, "1d", 2)
            except httpx.HTTPError:
                return code, None
        if len(candles) < 2:
            return code, None
        return code, {
            "prev_close": float(candles[-2]["closePrice"]),
            "volume": float(candles[-1]["volume"]),
        }

    results = await asyncio.gather(*[fetch_one(c) for c in codes])
    return {code: info for code, info in results if info is not None}


def _apply_change_rate(item: StockListItem, candle_info: dict | None) -> None:
    if candle_info and item.current_price is not None and candle_info["prev_close"]:
        item.change_rate = (item.current_price - candle_info["prev_close"]) / candle_info["prev_close"]


async def _fetch_rankings_safe(type_: str) -> dict[str, dict]:
    try:
        return await toss_client.get_rankings(type_, "KR", "realtime", 100)
    except httpx.HTTPError:
        return {}


@router.get("", response_model=ApiResponse[list[StockListItem]])
async def list_stocks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Stock).order_by(Stock.id))
    stocks = result.scalars().all()
    codes = [s.code for s in stocks]

    # 종목마다 따로 시세/캔들을 부르면 캔들 API 레이트리밋(초당 20건)에 쉽게 걸리므로,
    # 랭킹 API 한 번으로 대부분을 채우고, 랭킹 100위 밖이라 못 채운 종목만 개별 조회한다.
    rankings = await _fetch_rankings_safe("MARKET_TRADING_AMOUNT")
    missing_codes = [c for c in codes if c not in rankings]
    fallback_prices = await _fetch_prices_safe(missing_codes) if missing_codes else {}

    data = []
    for s in stocks:
        item = StockListItem.model_validate(s)
        ranking = rankings.get(s.code)
        if ranking:
            item.current_price = int(float(ranking["price"]["lastPrice"]))
            change_rate = ranking["price"].get("changeRate")
            if change_rate is not None:
                item.change_rate = float(change_rate)
        else:
            price = fallback_prices.get(s.code)
            if price:
                item.current_price = int(float(price["lastPrice"]))
        data.append(item)

    return ApiResponse(success=True, data=data, message="요청 성공")


@router.get("/rankings", response_model=ApiResponse[list[StockRankingItem]])
async def get_stock_rankings(db: AsyncSession = Depends(get_db)):
    """실시간 거래대금 랭킹. 토스 랭킹 API(시장 전체 거래대금 상위 100) 한 번으로 우리
    30종목 대부분을 빠르게 채우고, 100위 밖이라 랭킹에 안 걸린 나머지만 개별 조회(시세+캔들)로
    채워서 30종목을 항상 전부 반환한다. 개별 조회 대상은 100위 밖 종목뿐이라 많아야
    수십 개 수준이라 캔들 API 레이트리밋(초당 20건)에 안전하다.
    (주의: 반드시 /{stock_id}보다 먼저 등록되어야 "rankings"가 stock_id로 잘못 파싱되지 않음)
    """
    result = await db.execute(select(Stock).order_by(Stock.id))
    stocks = result.scalars().all()
    codes = [s.code for s in stocks]

    rankings = await _fetch_rankings_safe("MARKET_TRADING_AMOUNT")
    missing_codes = [c for c in codes if c not in rankings]

    fallback_prices = await _fetch_prices_safe(missing_codes) if missing_codes else {}
    fallback_candle_info = await _fetch_candle_info_safe(missing_codes) if missing_codes else {}

    ranked: list[tuple[int, StockRankingItem]] = []
    unranked: list[StockRankingItem] = []

    for s in stocks:
        ranking = rankings.get(s.code)
        if ranking:
            change_rate = ranking["price"].get("changeRate")
            item = StockRankingItem(
                rank=ranking["rank"],
                id=s.id,
                code=s.code,
                name=s.name,
                market=s.market,
                sector=s.sector,
                current_price=int(float(ranking["price"]["lastPrice"])),
                change_rate=float(change_rate) if change_rate is not None else None,
                trading_volume=int(float(ranking["tradingVolume"])),
                trading_amount=int(float(ranking["tradingAmount"])),
            )
            ranked.append((ranking["rank"], item))
        else:
            price = fallback_prices.get(s.code)
            current_price = int(float(price["lastPrice"])) if price else None
            candle_info = fallback_candle_info.get(s.code)
            prev_close = candle_info["prev_close"] if candle_info else None
            change_rate = (
                (current_price - prev_close) / prev_close
                if current_price is not None and prev_close
                else None
            )
            unranked.append(
                StockRankingItem(
                    rank=None,
                    id=s.id,
                    code=s.code,
                    name=s.name,
                    market=s.market,
                    sector=s.sector,
                    current_price=current_price,
                    change_rate=change_rate,
                    trading_volume=int(candle_info["volume"]) if candle_info else None,
                    trading_amount=None,
                )
            )

    ranked.sort(key=lambda pair: pair[0])
    data = [item for _, item in ranked] + unranked
    return ApiResponse(success=True, data=data, message="요청 성공")


async def _build_stock_detail(stock: Stock) -> StockDetail:
    detail = StockDetail.model_validate(stock)

    prices = await _fetch_prices_safe([stock.code])
    price = prices.get(stock.code)
    if price:
        detail.current_price = int(float(price["lastPrice"]))

    candle_info = (await _fetch_candle_info_safe([stock.code])).get(stock.code)
    _apply_change_rate(detail, candle_info)
    if candle_info:
        detail.volume = int(candle_info["volume"])

    return detail


@router.get("/by-code/{code}", response_model=ApiResponse[StockDetail])
async def get_stock_by_code(code: str, db: AsyncSession = Depends(get_db)):
    """종목 코드로 단건 조회. 상세페이지에서 종목 하나만 필요할 때 30종목 전체를 도는
    GET /stocks를 호출하지 않도록 별도로 둔다 (그러면 시세+등락률 계산 때문에 훨씬 느려짐)."""
    result = await db.execute(select(Stock).where(Stock.code == code))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    return ApiResponse(success=True, data=await _build_stock_detail(stock), message="요청 성공")


@router.get("/{stock_id}", response_model=ApiResponse[StockDetail])
async def get_stock(stock_id: int, db: AsyncSession = Depends(get_db)):
    stock = await db.get(Stock, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    return ApiResponse(success=True, data=await _build_stock_detail(stock), message="요청 성공")


@router.get("/{stock_id}/candles", response_model=ApiResponse[list[Candle]])
async def get_stock_candles(
    stock_id: int,
    interval: str = "1d",
    count: int = 100,
    db: AsyncSession = Depends(get_db),
):
    if interval not in ("1m", "1d"):
        raise HTTPException(status_code=400, detail="interval은 1m 또는 1d만 지원합니다")
    if not 1 <= count <= 200:
        raise HTTPException(status_code=400, detail="count는 1~200 사이여야 합니다")

    stock = await db.get(Stock, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    try:
        raw_candles = await toss_client.get_candles(stock.code, interval, count)
    except httpx.HTTPError:
        raw_candles = []

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

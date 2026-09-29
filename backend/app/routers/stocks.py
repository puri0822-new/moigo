import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core import toss_client
from app.core.price_fetch import fetch_candle_info_safe, fetch_prices_safe
from app.database import get_db
from app.models import Stock, StockPriceCache
from app.schemas.candle import Candle
from app.schemas.common import ApiResponse
from app.schemas.ranking import StockRankingItem
from app.schemas.stock import StockDetail, StockListItem

router = APIRouter(prefix="/stocks", tags=["Stocks"])


async def _fetch_rankings_safe(type_: str) -> dict[str, dict]:
    try:
        return await toss_client.get_rankings(type_, "KR", "realtime", 100)
    except httpx.HTTPError:
        return {}


def _apply_change_rate(item: StockListItem, candle_info: dict | None) -> None:
    if candle_info and item.current_price is not None and candle_info["prev_close"]:
        item.change_rate = (item.current_price - candle_info["prev_close"]) / candle_info["prev_close"]


@router.get("", response_model=ApiResponse[list[StockListItem]])
async def list_stocks(db: Session = Depends(get_db)):
    result = db.execute(select(Stock).order_by(Stock.id))
    stocks = result.scalars().all()
    codes = [s.code for s in stocks]

    # 종목마다 따로 시세/캔들을 부르면 캔들 API 레이트리밋(초당 20건)에 쉽게 걸리므로,
    # 랭킹 API 한 번으로 대부분을 채우고, 랭킹 100위 밖이라 못 채운 종목만 개별 조회한다.
    rankings = await _fetch_rankings_safe("MARKET_TRADING_AMOUNT")
    missing_codes = [c for c in codes if c not in rankings]
    fallback_prices = await fetch_prices_safe(missing_codes)

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
async def get_stock_rankings(db: Session = Depends(get_db)):
    """실시간 거래대금 랭킹. 토스를 매 요청마다 호출하지 않고, 백그라운드에서 주기적으로
    갱신되는 stock_price_cache 테이블만 읽어서 반환한다 (주기는 app.core.price_sync 참고).
    캐시가 아직 없는 종목(서버 기동 직후 등)은 시세 없이 null로 내려간다.
    (주의: 반드시 /{stock_id}보다 먼저 등록되어야 "rankings"가 stock_id로 잘못 파싱되지 않음)
    """
    try:
        result = db.execute(
            select(Stock, StockPriceCache)
            .outerjoin(StockPriceCache, StockPriceCache.stock_id == Stock.id)
            .order_by(StockPriceCache.market_rank.is_(None), StockPriceCache.market_rank, Stock.id)
        )
        rows = result.all()
    except SQLAlchemyError:
        # stock_price_cache 테이블이 아직 없는 등 DB 문제가 있어도 종목 목록 자체는 내려준다.
        db.rollback()
        result = db.execute(select(Stock).order_by(Stock.id))
        rows = [(s, None) for s in result.scalars().all()]

    data = [
        StockRankingItem(
            rank=cache.market_rank if cache else None,
            id=stock.id,
            code=stock.code,
            name=stock.name,
            market=stock.market,
            sector=stock.sector,
            current_price=cache.current_price if cache else None,
            change_rate=float(cache.change_rate) if cache and cache.change_rate is not None else None,
            trading_volume=cache.trading_volume if cache else None,
            trading_amount=cache.trading_amount if cache else None,
        )
        for stock, cache in rows
    ]

    return ApiResponse(success=True, data=data, message="요청 성공")


async def _build_stock_detail(stock: Stock) -> StockDetail:
    detail = StockDetail.model_validate(stock)

    prices = await fetch_prices_safe([stock.code])
    price = prices.get(stock.code)
    if price:
        detail.current_price = int(float(price["lastPrice"]))

    candle_info = (await fetch_candle_info_safe([stock.code])).get(stock.code)
    _apply_change_rate(detail, candle_info)
    if candle_info:
        detail.volume = int(candle_info["volume"])

    return detail


@router.get("/by-code/{code}", response_model=ApiResponse[StockDetail])
async def get_stock_by_code(code: str, db: Session = Depends(get_db)):
    """종목 코드로 단건 조회. 상세페이지에서 종목 하나만 필요할 때 30종목 전체를 도는
    GET /stocks를 호출하지 않도록 별도로 둔다 (그러면 시세+등락률 계산 때문에 훨씬 느려짐)."""
    result = db.execute(select(Stock).where(Stock.code == code))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    return ApiResponse(success=True, data=await _build_stock_detail(stock), message="요청 성공")


@router.get("/{stock_id}", response_model=ApiResponse[StockDetail])
async def get_stock(stock_id: int, db: Session = Depends(get_db)):
    stock = db.get(Stock, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    return ApiResponse(success=True, data=await _build_stock_detail(stock), message="요청 성공")


@router.get("/{stock_id}/candles", response_model=ApiResponse[list[Candle]])
async def get_stock_candles(
    stock_id: int,
    interval: str = "1d",
    count: int = 100,
    db: Session = Depends(get_db),
):
    if interval not in ("1m", "1d"):
        raise HTTPException(status_code=400, detail="interval은 1m 또는 1d만 지원합니다")
    if not 1 <= count <= 200:
        raise HTTPException(status_code=400, detail="count는 1~200 사이여야 합니다")

    stock = db.get(Stock, stock_id)
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

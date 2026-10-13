import asyncio
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core import naver_client, toss_client
from app.core.candle_agg import aggregate_daily
from app.core.candle_store import get_daily_bars
from app.core.price_fetch import fetch_prices_safe
from app.database import get_db
from app.models import Stock, StockPriceCache
from app.schemas.candle import Candle
from app.schemas.common import ApiResponse
from app.schemas.news import NewsItem
from app.schemas.ranking import StockRankingItem
from app.schemas.stock import StockDetail, StockListItem

router = APIRouter(prefix="/stocks", tags=["Stocks"])
logger = logging.getLogger("uvicorn.error")

TOSS_TIMEOUT_SECONDS = 6

# 봉 하나를 만드는 데 드는 거래일 수(대략). 필요한 일봉 개수를 어림잡는 용도.
# 일봉은 DB(stock_daily_candles)에서 읽고, 주/월/년봉은 그 일봉을 묶어서 만든다.
_TRADING_DAYS_PER_BAR = {"1d": 1, "1w": 5, "1mo": 22, "1y": 250}
_MAX_DAILY_HISTORY = 2500  # 약 10년치. 토스에 이보다 긴 이력이 있어도 여기까지만 쓴다
_MAX_BAR_COUNT = 2000


def _load_stocks_with_cache(db: Session, *where, order_by=(Stock.id,)) -> list[tuple[Stock, StockPriceCache | None]]:
    """종목과 시세 캐시(stock_price_cache)를 함께 조회. 시세는 app.core.price_sync가 백그라운드에서
    채우므로 요청 경로에서는 토스를 호출하지 않는다. 캐시 행이 아직 없으면(서버 기동 직후 등) None."""
    try:
        result = db.execute(
            select(Stock, StockPriceCache)
            .outerjoin(StockPriceCache, StockPriceCache.stock_id == Stock.id)
            .where(*where)
            .order_by(*order_by)
        )
        return [(stock, cache) for stock, cache in result.all()]
    except SQLAlchemyError:
        # 캐시 테이블이 아직 없는 등 DB 문제가 있어도 종목 정보 자체는 시세 없이 내려준다
        db.rollback()
        logger.exception("stock_price_cache 조회 실패")
        result = db.execute(select(Stock).where(*where).order_by(Stock.id))
        return [(stock, None) for stock in result.scalars().all()]


def _apply_cache(item: StockListItem, cache: StockPriceCache | None) -> None:
    if cache:
        item.current_price = cache.current_price
        item.change_rate = float(cache.change_rate) if cache.change_rate is not None else None


@router.get("", response_model=ApiResponse[list[StockListItem]])
async def list_stocks(db: Session = Depends(get_db)):
    data = []
    for stock, cache in _load_stocks_with_cache(db):
        item = StockListItem.model_validate(stock)
        _apply_cache(item, cache)
        data.append(item)
    return ApiResponse(success=True, data=data, message="요청 성공")


@router.get("/rankings", response_model=ApiResponse[list[StockRankingItem]])
async def get_stock_rankings(db: Session = Depends(get_db)):
    """실시간 거래대금 랭킹. 거래대금 100위 안의 종목을 실제 순위대로 앞에 두고, 100위 밖 종목은 뒤에 붙인다.
    (주의: 반드시 /{stock_id}보다 먼저 등록되어야 "rankings"가 stock_id로 잘못 파싱되지 않음)"""
    rows = _load_stocks_with_cache(
        db, order_by=(StockPriceCache.market_rank.is_(None), StockPriceCache.market_rank, Stock.id)
    )
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


async def _build_stock_detail(db: Session, stock: Stock, cache: StockPriceCache | None) -> StockDetail:
    """상세페이지는 3초마다 다시 묻기 때문에 30초 주기 캐시 대신 토스 현재가와 DB 일봉으로 채운다.
    토스 조회가 실패하면 캐시 테이블 값을 그대로 내려준다."""
    detail = StockDetail.model_validate(stock)
    _apply_cache(detail, cache)
    if cache:
        detail.volume = cache.trading_volume

    prices = await fetch_prices_safe([stock.code])
    price = prices.get(stock.code)
    if price:
        detail.current_price = int(float(price["lastPrice"]))

    # 전일 종가와 오늘 거래량은 DB의 최근 일봉 두 개에서 읽는다. (오늘 봉은 일정 주기로 토스에서 갱신된다)
    bars = await get_daily_bars(db, stock, 2)
    if len(bars) == 2:
        prev_close = bars[0]["closePrice"]
        if detail.current_price is not None and prev_close:
            detail.change_rate = (detail.current_price - prev_close) / prev_close
        detail.volume = int(bars[1]["volume"])

    return detail


@router.get("/by-code/{code}", response_model=ApiResponse[StockDetail])
async def get_stock_by_code(code: str, db: Session = Depends(get_db)):
    """종목 코드로 단건 조회. 상세페이지에서 종목 하나만 필요할 때 전체 목록을 받지 않도록 별도로 둔다."""
    rows = _load_stocks_with_cache(db, Stock.code == code)
    if not rows:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    return ApiResponse(success=True, data=await _build_stock_detail(db, *rows[0]), message="요청 성공")


@router.get("/{stock_id}", response_model=ApiResponse[StockDetail])
async def get_stock(stock_id: int, db: Session = Depends(get_db)):
    rows = _load_stocks_with_cache(db, Stock.id == stock_id)
    if not rows:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    return ApiResponse(success=True, data=await _build_stock_detail(db, *rows[0]), message="요청 성공")


@router.get("/{stock_id}/candles", response_model=ApiResponse[list[Candle]])
async def get_stock_candles(
    stock_id: int,
    interval: str = "1d",
    count: int = 100,
    db: Session = Depends(get_db),
):
    if interval != "1m" and interval not in _TRADING_DAYS_PER_BAR:
        raise HTTPException(status_code=400, detail="interval은 1m, 1d, 1w, 1mo, 1y만 지원합니다")
    if not 1 <= count <= _MAX_BAR_COUNT:
        raise HTTPException(status_code=400, detail=f"count는 1~{_MAX_BAR_COUNT} 사이여야 합니다")
    # count를 넉넉히 요청하면 있는 만큼 전부 준다. 주/월/년봉이 필요로 하는 일봉 개수는 상한까지만 읽는다.
    daily_needed = min(_MAX_DAILY_HISTORY, count if interval == "1d" else (count + 1) * _TRADING_DAYS_PER_BAR.get(interval, 0))

    stock = db.get(Stock, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    try:
        if interval == "1m":
            raw_candles = await asyncio.wait_for(
                toss_client.get_candles(stock.code, interval, count), TOSS_TIMEOUT_SECONDS
            )
        else:
            # 주/월/년봉은 진행 중인 기간 하나가 중간에 잘려 있을 수 있어 한 기간 더 받아 묶은 뒤 뒤에서 count개만 쓴다
            # (일봉 갱신이 실패해도 get_daily_bars가 DB에 있는 만큼은 돌려준다)
            daily = await get_daily_bars(db, stock, daily_needed)
            raw_candles = daily[-count:] if interval == "1d" else aggregate_daily(daily, interval)[-count:]
    except (httpx.HTTPError, asyncio.TimeoutError) as e:
        # 빈 배열로 내려주면 프론트가 "데이터 없음"과 "조회 실패"를 구분하지 못하므로 에러로 응답한다
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


@router.get("/{stock_id}/news", response_model=ApiResponse[list[NewsItem]])
async def get_stock_news(stock_id: int, limit: int = 10, db: Session = Depends(get_db)):
    stock = db.get(Stock, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    try:
        items = await asyncio.wait_for(naver_client.search_news(stock.name, display=limit), TOSS_TIMEOUT_SECONDS)
    except (httpx.HTTPError, asyncio.TimeoutError):
        items = []

    data = [NewsItem(id=i + 1, **item) for i, item in enumerate(items)]
    return ApiResponse(success=True, data=data, message="요청 성공")

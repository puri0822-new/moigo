import asyncio
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import naver_client, toss_client
from app.core.database import get_db
from app.models import Stock, StockPriceCache
from app.schemas.candle import Candle
from app.schemas.common import ApiResponse
from app.schemas.news import NewsItem
from app.schemas.ranking import StockRankingItem
from app.schemas.stock import StockDetail, StockListItem

router = APIRouter(prefix="/stocks", tags=["Stocks"])
logger = logging.getLogger("uvicorn.error")

TOSS_TIMEOUT_SECONDS = 6


async def _load_stocks_with_cache(db: AsyncSession, *where, order_by=(Stock.id,)) -> list[tuple[Stock, StockPriceCache | None]]:
    """종목과 시세 캐시(stock_price_cache)를 함께 조회. 시세는 app.core.price_sync가 백그라운드에서
    채우므로 요청 경로에서는 토스를 호출하지 않는다. 캐시 행이 아직 없으면(서버 기동 직후 등) None."""
    try:
        result = await db.execute(
            select(Stock, StockPriceCache)
            .outerjoin(StockPriceCache, StockPriceCache.stock_id == Stock.id)
            .where(*where)
            .order_by(*order_by)
        )
        return [(stock, cache) for stock, cache in result.all()]
    except SQLAlchemyError:
        # 캐시 테이블이 아직 없는 등 DB 문제가 있어도 종목 정보 자체는 시세 없이 내려준다
        await db.rollback()
        logger.exception("stock_price_cache 조회 실패")
        result = await db.execute(select(Stock).where(*where).order_by(Stock.id))
        return [(stock, None) for stock in result.scalars().all()]


def _apply_cache(item: StockListItem, cache: StockPriceCache | None) -> None:
    if cache:
        item.current_price = cache.current_price
        item.change_rate = float(cache.change_rate) if cache.change_rate is not None else None


@router.get("", response_model=ApiResponse[list[StockListItem]])
async def list_stocks(db: AsyncSession = Depends(get_db)):
    data = []
    for stock, cache in await _load_stocks_with_cache(db):
        item = StockListItem.model_validate(stock)
        _apply_cache(item, cache)
        data.append(item)
    return ApiResponse(success=True, data=data, message="요청 성공")


@router.get("/rankings", response_model=ApiResponse[list[StockRankingItem]])
async def get_stock_rankings(db: AsyncSession = Depends(get_db)):
    """실시간 거래대금 랭킹. 거래대금 100위 안의 종목을 실제 순위대로 앞에 두고, 100위 밖 종목은 뒤에 붙인다.
    (주의: 반드시 /{stock_id}보다 먼저 등록되어야 "rankings"가 stock_id로 잘못 파싱되지 않음)"""
    rows = await _load_stocks_with_cache(
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


def _build_stock_detail(stock: Stock, cache: StockPriceCache | None) -> StockDetail:
    detail = StockDetail.model_validate(stock)
    _apply_cache(detail, cache)
    if cache:
        detail.volume = cache.trading_volume
    return detail


@router.get("/by-code/{code}", response_model=ApiResponse[StockDetail])
async def get_stock_by_code(code: str, db: AsyncSession = Depends(get_db)):
    """종목 코드로 단건 조회. 상세페이지에서 종목 하나만 필요할 때 전체 목록을 받지 않도록 별도로 둔다."""
    rows = await _load_stocks_with_cache(db, Stock.code == code)
    if not rows:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    return ApiResponse(success=True, data=_build_stock_detail(*rows[0]), message="요청 성공")


@router.get("/{stock_id}", response_model=ApiResponse[StockDetail])
async def get_stock(stock_id: int, db: AsyncSession = Depends(get_db)):
    rows = await _load_stocks_with_cache(db, Stock.id == stock_id)
    if not rows:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    return ApiResponse(success=True, data=_build_stock_detail(*rows[0]), message="요청 성공")


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
        raw_candles = await asyncio.wait_for(
            toss_client.get_candles(stock.code, interval, count), TOSS_TIMEOUT_SECONDS
        )
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

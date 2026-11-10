import asyncio
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import news_issues
from app.database import get_db
from app.models import Stock, StockPriceCache
from app.schemas.common import ApiResponse
from app.schemas.news import MarketNewsIssue

router = APIRouter(prefix="/news", tags=["News"])
logger = logging.getLogger("uvicorn.error")

HOT_STOCK_COUNT = 10  # 거래대금 상위 몇 종목의 이슈를 모을지
PER_STOCK_ISSUES = 5
CONCURRENCY = 5  # 네이버 검색 API를 한꺼번에 너무 많이 부르지 않도록 동시에 처리할 종목 수
ISSUES_TIMEOUT_SECONDS = 25


def _hot_stocks(db: Session) -> list[Stock]:
    """시세 캐시 기준 거래대금 상위 종목."""
    rows = db.execute(
        select(Stock)
        .join(StockPriceCache, StockPriceCache.stock_id == Stock.id)
        .where(StockPriceCache.trading_amount.is_not(None))
        .order_by(StockPriceCache.trading_amount.desc())
        .limit(HOT_STOCK_COUNT)
    ).scalars().all()
    return list(rows)


async def _collect_market_issues(stocks: list[tuple[int, str, str]]) -> list[dict]:
    sem = asyncio.Semaphore(CONCURRENCY)

    async def one(stock_id: int, code: str, name: str) -> list[dict]:
        async with sem:
            try:
                issues = await news_issues.top_issues(name, limit=PER_STOCK_ISSUES)
            except httpx.HTTPError as e:
                logger.warning("핵심 이슈 조회 실패 (%s): %r", name, e)
                return []
        stock = {"id": stock_id, "code": code, "name": name}
        return [{**issue, "stocks": [stock]} for issue in issues]

    per_stock = await asyncio.gather(*(one(*s) for s in stocks))

    # 같은 사건이 여러 종목에 걸리면 (예: 삼성전자·SK하이닉스 동반 급등) 기사 주소가 겹친다 → 하나로 합치고 종목 태그만 모은다
    merged: list[dict] = []
    for issue in (x for group in per_stock for x in group):
        urls = {issue["url"], *(r["url"] for r in issue["related"])}
        same = next((m for m in merged if m["_urls"] & urls), None)
        if same is None:
            merged.append({**issue, "_urls": urls})
            continue
        same["_urls"] |= urls
        if issue["stocks"][0]["id"] not in {s["id"] for s in same["stocks"]}:
            same["stocks"] = same["stocks"] + issue["stocks"]
        if issue["score"] > same["score"]:
            # 더 크게 다뤄진 쪽의 대표 기사와 집계를 쓴다
            same.update({k: v for k, v in issue.items() if k != "stocks"})

    merged.sort(key=lambda x: (x["score"], x["latest_published_at"]), reverse=True)
    return merged


@router.get("/issues", response_model=ApiResponse[list[MarketNewsIssue]])
async def get_market_issues(limit: int = 15, db: Session = Depends(get_db)):
    """거래대금 상위 종목들의 최근 7일 핵심 이슈를 모아, 많이 보도된 순서로."""
    stocks = await run_in_threadpool(lambda: [(s.id, s.code, s.name) for s in _hot_stocks(db)])
    if not stocks:
        return ApiResponse(success=True, data=[], message="요청 성공")

    try:
        issues = await asyncio.wait_for(_collect_market_issues(stocks), ISSUES_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=502, detail="핵심 뉴스를 불러오지 못했습니다")

    data = [
        MarketNewsIssue(id=i + 1, **{k: v for k, v in issue.items() if k != "_urls"})
        for i, issue in enumerate(issues[:min(limit, 30)])
    ]
    return ApiResponse(success=True, data=data, message="요청 성공")

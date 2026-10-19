from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

import logging

from app.core import claude_client, clova_client, gemini_client
from app.core.news_pipeline import collect_for_analysis
from app.core.price_fetch import fetch_prices_safe
from app.models import AiAnalysis, AiAnalysisNews, News, Stock, StockPriceCache

logger = logging.getLogger(__name__)

# 모델별 상한. Gemini Interactions가 가끔 60~70초까지 늘어나 전체를 막는다.
_GEMINI_TIMEOUT = 25.0
_CLAUDE_TIMEOUT = 20.0
_CLOVA_TIMEOUT = 20.0


async def _with_timeout(label: str, coro, timeout: float):
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning("%s 분석 타임아웃 (%.0fs)", label, timeout)
        return None
    except Exception:
        logger.exception("%s 분석 예외", label)
        return None


def _news_payload(news_rows: list[News]) -> list[dict]:
    return [
        {
            "title": n.title,
            "summary": n.summary,
            "source": n.source,
            "published_at": n.published_at.isoformat() if n.published_at else "",
            "url": n.url,
        }
        for n in news_rows
    ]


def _pick_sentiment(*results: dict | None) -> str | None:
    for result in results:
        if result:
            return result["sentiment"]
    return None


def _is_matched(*results: dict | None) -> bool | None:
    recs = [r["recommendation"] for r in results if r]
    if len(recs) < 2:
        return None
    return len(set(recs)) == 1


async def _current_price(db: Session, stock: Stock) -> int | None:
    cache = db.execute(
        select(StockPriceCache).where(StockPriceCache.stock_id == stock.id)
    ).scalar_one_or_none()
    if cache and cache.current_price is not None:
        return int(cache.current_price)

    prices = await fetch_prices_safe([stock.code])
    price = prices.get(stock.code)
    if price and price.get("lastPrice") is not None:
        return int(float(price["lastPrice"]))
    return None


async def run_analysis(db: Session, stock: Stock) -> AiAnalysis:
    news_rows = await collect_for_analysis(db, stock)
    payload = _news_payload(news_rows)

    # 병렬 + 모델별 타임아웃. 느린 Gemini 때문에 CLOVA 결과가 묻히지 않게 한다.
    gemini, claude, clova = await asyncio.gather(
        _with_timeout("Gemini", gemini_client.analyze_news(stock.name, payload), _GEMINI_TIMEOUT),
        _with_timeout("Claude", claude_client.analyze_news(stock.name, payload), _CLAUDE_TIMEOUT),
        _with_timeout("CLOVA", clova_client.analyze_news(stock.name, payload), _CLOVA_TIMEOUT),
    )

    if gemini is None and claude is None and clova is None:
        raise RuntimeError("AI 분석에 사용할 API 키가 없거나 호출에 실패했습니다")

    analysis = AiAnalysis(
        stock_id=stock.id,
        gemini_result=gemini["summary"] if gemini else None,
        claude_result=claude["summary"] if claude else None,
        clova_result=clova["summary"] if clova else None,
        gemini_recommendation=gemini["recommendation"] if gemini else None,
        claude_recommendation=claude["recommendation"] if claude else None,
        clova_recommendation=clova["recommendation"] if clova else None,
        is_matched=_is_matched(gemini, claude, clova),
        sentiment=_pick_sentiment(gemini, clova, claude),
        price_at_analysis=await _current_price(db, stock),
        # DB now()는 트랜잭션 시작 시각이라 긴 AI 호출 후 순서가 꼬일 수 있음
        analyzed_at=datetime.now(timezone.utc),
    )
    db.add(analysis)
    db.flush()

    for news in news_rows:
        db.add(AiAnalysisNews(ai_analysis_id=analysis.id, news_id=news.id))

    db.commit()
    db.refresh(analysis)
    return analysis


def get_latest_analysis(db: Session, stock_id: int) -> AiAnalysis | None:
    return db.execute(
        select(AiAnalysis)
        .where(AiAnalysis.stock_id == stock_id)
        .order_by(AiAnalysis.id.desc())
        .limit(1)
    ).scalar_one_or_none()


def related_news_for(db: Session, analysis_id: int) -> list[News]:
    return list(
        db.execute(
            select(News)
            .join(AiAnalysisNews, AiAnalysisNews.news_id == News.id)
            .where(AiAnalysisNews.ai_analysis_id == analysis_id)
            .order_by(News.published_at.desc())
        ).scalars()
    )

"""AI 분석용 뉴스 수집. 엄격한 품질 필터 없이 최근순·중복 제거만 한다."""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import naver_client
from app.models import News, Stock

_AI_FETCH_COUNT = 15
_AI_MAX_ITEMS = 5  # AI 프롬프트·대기시간 단축 (너무 많으면 Gemini가 수십 초)
_TITLE_NOISE_RE = re.compile(r"[\s\[\]\(\)【】『』「」\"'“”‘’·…]+")


def _norm_title(title: str) -> str:
    return _TITLE_NOISE_RE.sub("", title).lower()


def light_clean(items: list[dict], limit: int = _AI_MAX_ITEMS) -> list[dict]:
    """URL·제목 중복을 제거하고 앞에서부터 limit건만 남긴다(이미 최신순)."""
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    out: list[dict] = []
    for item in items:
        url = (item.get("url") or "").strip()
        title = (item.get("title") or "").strip()
        if not url or not title:
            continue
        nt = _norm_title(title)
        if url in seen_urls or nt in seen_titles:
            continue
        seen_urls.add(url)
        seen_titles.add(nt)
        out.append(item)
        if len(out) >= limit:
            break
    return out


async def collect_for_analysis(db: Session, stock: Stock) -> list[News]:
    """네이버에서 가져와 가볍게 정리한 뒤 news 테이블에 저장하고 ORM 목록을 반환한다."""
    raw = await naver_client.search_news(stock.name, display=_AI_FETCH_COUNT)
    cleaned = light_clean(raw, _AI_MAX_ITEMS)

    existing_urls = {
        row
        for row in db.execute(
            select(News.url).where(News.stock_id == stock.id, News.url.in_([c["url"] for c in cleaned] or [""]))
        ).scalars()
    }

    saved: list[News] = []
    for item in cleaned:
        if item["url"] in existing_urls:
            news = db.execute(
                select(News).where(News.stock_id == stock.id, News.url == item["url"])
            ).scalar_one()
        else:
            news = News(
                stock_id=stock.id,
                title=item["title"],
                summary=item.get("summary"),
                url=item["url"],
                source=item.get("source"),
                published_at=item["published_at"],
            )
            db.add(news)
            db.flush()
        saved.append(news)

    return saved

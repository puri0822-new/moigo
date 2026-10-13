import html
import re
import time
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse

import httpx

from app.core.config import settings

ENDPOINT = "https://naverapihub.apigw.ntruss.com/search/v1/news"
CACHE_TTL_SECONDS = 300

_TAG_RE = re.compile(r"<[^>]+>")
_cache: dict[str, tuple[list[dict], float]] = {}


def _clean(text: str) -> str:
    return html.unescape(_TAG_RE.sub("", text))


async def search_news(query: str, display: int = 10) -> list[dict]:
    """종목명으로 관련 뉴스를 검색. 결과는 5분간 캐시."""
    now = time.monotonic()
    cached = _cache.get(query)
    if cached and now - cached[1] < CACHE_TTL_SECONDS:
        return cached[0][:display]

    headers = {
        "X-NCP-APIGW-API-KEY-ID": settings.NAVER_CLIENT_ID,
        "X-NCP-APIGW-API-KEY": settings.NAVER_CLIENT_SECRET,
    }
    params = {"query": query, "display": display, "sort": "date"}

    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(ENDPOINT, headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json()

    items = [
        {
            "title": _clean(item["title"]),
            "summary": _clean(item["description"]),
            "url": item["link"],
            "source": urlparse(item["originallink"] or item["link"]).netloc,
            "published_at": parsedate_to_datetime(item["pubDate"]),
        }
        for item in data.get("items", [])
    ]
    _cache[query] = (items, now)
    return items

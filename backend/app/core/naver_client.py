import asyncio
import html
import re
import time
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlparse

import httpx

from app.core.config import settings

ENDPOINT = "https://naverapihub.apigw.ntruss.com/search/v1/news"
CACHE_TTL_SECONDS = 300

IMAGE_TIMEOUT_SECONDS = 2.5
IMAGE_HTML_MAX_BYTES = 300_000

_TAG_RE = re.compile(r"<[^>]+>")
_OG_IMAGE_RES = (
    re.compile(r'<meta[^>]+property=["\']og:image["\'][^>]*content=["\']([^"\']+)', re.I),
    re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']', re.I),
)
# (기사 목록, 저장 시각, 필터를 통과한 전체 기사 수)
_cache: dict[str, tuple[list[dict], float, int]] = {}

SEARCH_DISPLAY = 100  # 네이버 뉴스 검색 API의 1회 최대 건수

# 기사 제목에서 정식 종목명 대신 흔히 쓰이는 이름. 앞에 있는 것부터 추가 검색에 쓴다.
NEWS_ALIASES: dict[str, list[str]] = {
    "NAVER": ["네이버"],
    "SM엔터테인먼트": ["SM엔터", "에스엠엔터"],
    "신한지주": ["신한금융"],
    "엔씨소프트": ["엔씨", "NC소프트"],
    "LG에너지솔루션": ["LG엔솔"],
    "SK이노베이션": ["SK이노"],
    "SK하이닉스": ["하이닉스"],
    "한국전력": ["한전"],
    "POSCO홀딩스": ["포스코홀딩스"],
    "현대차": ["현대자동차"],
    "KB금융": ["KB금융지주"],
}


def _clean(text: str) -> str:
    return html.unescape(_TAG_RE.sub("", text))


async def _fetch_og_image(client: httpx.AsyncClient, url: str) -> str | None:
    """기사 페이지의 대표 이미지(og:image) 주소. 느리거나 없으면 None."""
    if urlparse(url).scheme not in ("http", "https"):
        return None
    try:
        resp = await client.get(url)
        resp.raise_for_status()
    except httpx.HTTPError:
        return None

    page = resp.content[:IMAGE_HTML_MAX_BYTES].decode("utf-8", "ignore")
    for pattern in _OG_IMAGE_RES:
        match = pattern.search(page)
        if match:
            image = urljoin(str(resp.url), html.unescape(match.group(1)))
            return image if urlparse(image).scheme in ("http", "https") else None
    return None


async def _search(client: httpx.AsyncClient, query: str) -> list[dict]:
    headers = {
        "X-NCP-APIGW-API-KEY-ID": settings.NAVER_CLIENT_ID,
        "X-NCP-APIGW-API-KEY": settings.NAVER_CLIENT_SECRET,
    }
    params = {"query": query, "display": SEARCH_DISPLAY, "sort": "date"}
    resp = await client.get(ENDPOINT, headers=headers, params=params)
    resp.raise_for_status()
    return [
        {
            "title": _clean(item["title"]),
            "summary": _clean(item["description"]),
            "url": item["link"],
            "source": urlparse(item["originallink"] or item["link"]).netloc,
            "published_at": parsedate_to_datetime(item["pubDate"]),
        }
        for item in resp.json().get("items", [])
    ]


async def search_news(stock_name: str, display: int = 10) -> list[dict]:
    """종목 관련 뉴스를 최신순으로 검색. 본문에 이름만 스친 기사를 빼려고 제목에 종목명(또는 별칭)이
    들어간 기사만 남긴다. 결과는 5분간 캐시."""
    now = time.monotonic()
    cached = _cache.get(stock_name)
    if cached and now - cached[1] < CACHE_TTL_SECONDS and len(cached[0]) >= min(display, cached[2]):
        return cached[0][:display]

    aliases = NEWS_ALIASES.get(stock_name, [])
    keywords = [k.lower() for k in (stock_name, *aliases)]

    def matched(found: list[dict]) -> list[dict]:
        return [item for item in found if any(k in item["title"].lower() for k in keywords)]

    async with httpx.AsyncClient(timeout=5) as client:
        items = matched(await _search(client, stock_name))
        # 기사 제목이 주로 별칭으로 쓰이는 종목은 정식 명칭 검색만으로는 모자라 별칭으로도 찾는다
        for alias in aliases:
            if len(items) >= display:
                break
            seen = {item["url"] for item in items}
            items += [item for item in matched(await _search(client, alias)) if item["url"] not in seen]

    items.sort(key=lambda item: item["published_at"], reverse=True)
    total = len(items)
    items = items[:display]

    async with httpx.AsyncClient(
        timeout=IMAGE_TIMEOUT_SECONDS, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}
    ) as client:
        images = await asyncio.gather(*(_fetch_og_image(client, item["url"]) for item in items))
    for item, image in zip(items, images):
        item["image_url"] = image

    _cache[stock_name] = (items, now, total)
    return items

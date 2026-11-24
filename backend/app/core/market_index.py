"""코스피·코스닥 지수 (네이버 증권). AI 추천을 시장 대비 초과수익으로 채점할 때 쓴다."""

import time
from datetime import date

import httpx

BASIC_URL = "https://m.stock.naver.com/api/index/{code}/basic"
HISTORY_URL = "https://m.stock.naver.com/api/index/{code}/price"
HISTORY_PAGE_SIZE = 60
HISTORY_MAX_PAGES = 5
CACHE_TTL_SECONDS = 600
CURRENT_TTL_SECONDS = 60

# (거래일 → 종가, 저장 시각)
_history: dict[str, tuple[dict[date, float], float]] = {}
# (지수, 저장 시각)
_current: dict[str, tuple[float, float]] = {}


def index_code(market: str | None) -> str:
    """종목 시장(stocks.market)에 맞는 지수 코드. 모르는 시장은 코스피와 비교한다."""
    return "KOSDAQ" if market == "KOSDAQ" else "KOSPI"


def _num(value) -> float:
    return float(str(value).replace(",", ""))


async def current(code: str) -> float | None:
    """지금 지수 (장 마감 뒤면 그날 종가). 못 받으면 None."""
    cached = _current.get(code)
    if cached and time.monotonic() - cached[1] < CURRENT_TTL_SECONDS:
        return cached[0]
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(BASIC_URL.format(code=code))
            resp.raise_for_status()
            value = _num(resp.json()["closePrice"])
    except (httpx.HTTPError, KeyError, ValueError):
        return None
    _current[code] = (value, time.monotonic())
    return value


async def _closes_since(code: str, target: date) -> dict[date, float]:
    cached = _history.get(code)
    if cached and time.monotonic() - cached[1] < CACHE_TTL_SECONDS and cached[0] and min(cached[0]) <= target:
        return cached[0]
    closes: dict[date, float] = {}
    async with httpx.AsyncClient(timeout=5) as client:
        for page in range(1, HISTORY_MAX_PAGES + 1):
            resp = await client.get(HISTORY_URL.format(code=code), params={"pageSize": HISTORY_PAGE_SIZE, "page": page})
            resp.raise_for_status()
            rows = resp.json()
            for row in rows:
                closes[date.fromisoformat(row["localTradedAt"][:10])] = _num(row["closePrice"])
            if len(rows) < HISTORY_PAGE_SIZE or (closes and min(closes) <= target):
                break
    _history[code] = (closes, time.monotonic())
    return closes


async def close_on_or_before(code: str, target: date) -> float | None:
    """target 날짜(주말·휴장일이면 그 직전 거래일)의 지수 종가. 못 받으면 None."""
    try:
        closes = await _closes_since(code, target)
    except (httpx.HTTPError, KeyError, ValueError):
        return None
    days = [d for d in closes if d <= target]
    return closes[max(days)] if days else None

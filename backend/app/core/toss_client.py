import asyncio
import time

import httpx

from app.core.config import settings

BASE_URL = "https://openapi.tossinvest.com"
PRICE_CACHE_TTL_SECONDS = 60
CANDLE_CACHE_TTL_SECONDS = 60
RANKING_CACHE_TTL_SECONDS = 30

_token_lock = asyncio.Lock()
_token_cache: dict[str, str | float] = {"access_token": "", "expires_at": 0.0}

_price_cache: dict[str, tuple[dict, float]] = {}
_candle_cache: dict[tuple[str, str, int], tuple[list[dict], float]] = {}
_ranking_cache: dict[tuple[str, str, str], tuple[dict[str, dict], float]] = {}


async def _get_access_token() -> str:
    now = time.monotonic()
    if _token_cache["access_token"] and now < _token_cache["expires_at"]:
        return _token_cache["access_token"]  # type: ignore[return-value]

    async with _token_lock:
        # 락 대기 중 다른 요청이 이미 갱신했을 수 있으니 재확인
        now = time.monotonic()
        if _token_cache["access_token"] and now < _token_cache["expires_at"]:
            return _token_cache["access_token"]  # type: ignore[return-value]

        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                f"{BASE_URL}/oauth2/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.TOSS_CLIENT_ID,
                    "client_secret": settings.TOSS_CLIENT_SECRET,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        _token_cache["access_token"] = data["access_token"]
        # 만료 60초 전에 미리 갱신
        _token_cache["expires_at"] = now + data["expires_in"] - 60
        return data["access_token"]  # type: ignore[return-value]


async def get_prices(symbols: list[str]) -> dict[str, dict]:
    """종목 코드 목록의 현재가를 조회. 60초 이내 조회한 종목은 캐시에서 반환."""
    if not symbols:
        return {}

    now = time.monotonic()
    result: dict[str, dict] = {}
    to_fetch: list[str] = []

    for symbol in symbols:
        cached = _price_cache.get(symbol)
        if cached and now - cached[1] < PRICE_CACHE_TTL_SECONDS:
            result[symbol] = cached[0]
        else:
            to_fetch.append(symbol)

    if not to_fetch:
        return result

    token = await _get_access_token()
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(
            f"{BASE_URL}/api/v1/prices",
            headers={"Authorization": f"Bearer {token}"},
            params={"symbols": ",".join(to_fetch)},
        )
        resp.raise_for_status()
        data = resp.json()

    for item in data.get("result", []):
        _price_cache[item["symbol"]] = (item, now)
        result[item["symbol"]] = item

    return result


async def get_candles(symbol: str, interval: str, count: int) -> list[dict]:
    """종목의 캔들(OHLCV) 데이터를 조회. 오래된 봉부터 오름차순으로 반환. 60초간 캐시."""
    cache_key = (symbol, interval, count)
    now = time.monotonic()
    cached = _candle_cache.get(cache_key)
    if cached and now - cached[1] < CANDLE_CACHE_TTL_SECONDS:
        return cached[0]

    token = await _get_access_token()
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(
            f"{BASE_URL}/api/v1/candles",
            headers={"Authorization": f"Bearer {token}"},
            params={"symbol": symbol, "interval": interval, "count": count},
        )
        resp.raise_for_status()
        data = resp.json()

    # 토스는 최신순(내림차순)으로 반환하므로, 차트 라이브러리가 기대하는 오름차순으로 뒤집는다
    candles = list(reversed(data["result"]["candles"]))
    _candle_cache[cache_key] = (candles, now)
    return candles


async def get_rankings(type_: str, market_country: str, duration: str, count: int = 100) -> dict[str, dict]:
    """랭킹 API로 다건 종목의 현재가·등락률·거래량을 한 번에 조회.
    종목별로 캔들/현재가 API를 따로 호출하면 초당 레이트리밋(캔들 API 기준 20건/초)에
    쉽게 걸리므로, 목록 화면처럼 여러 종목을 한꺼번에 봐야 할 때는 이 함수를 우선 사용한다.
    반환값은 symbol을 키로 하는 dict."""
    cache_key = (type_, market_country, duration)
    now = time.monotonic()
    cached = _ranking_cache.get(cache_key)
    if cached and now - cached[1] < RANKING_CACHE_TTL_SECONDS:
        return cached[0]

    token = await _get_access_token()
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(
            f"{BASE_URL}/api/v1/rankings",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "type": type_,
                "marketCountry": market_country,
                "duration": duration,
                "count": count,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    by_symbol = {item["symbol"]: item for item in data["result"]["rankings"]}
    _ranking_cache[cache_key] = (by_symbol, now)
    return by_symbol

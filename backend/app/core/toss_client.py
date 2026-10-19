import asyncio
import time

import httpx

from app.core.config import settings

BASE_URL = "https://openapi.tossinvest.com"
PRICE_CACHE_TTL_SECONDS = 60
CANDLE_CACHE_TTL_SECONDS = 60
STOCK_INFO_CACHE_TTL_SECONDS = 3600
ORDERBOOK_CACHE_TTL_SECONDS = 2

_token_lock = asyncio.Lock()
_token_cache: dict[str, str | float] = {"access_token": "", "expires_at": 0.0}

_price_cache: dict[str, tuple[dict, float]] = {}
_candle_cache: dict[tuple[str, str, int], tuple[list[dict], float]] = {}
_stock_info_cache: dict[str, tuple[dict, float]] = {}
_orderbook_cache: dict[str, tuple[dict, float]] = {}


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


async def _api_get(path: str, params: dict) -> dict:
    """토스 API GET 호출. 토큰이 무효가 되면(401) 새 토큰으로 한 번만 다시 시도한다."""
    token = await _get_access_token()
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(f"{BASE_URL}{path}", headers={"Authorization": f"Bearer {token}"}, params=params)
        if resp.status_code == 401:
            # 동시에 401을 받은 다른 요청이 이미 새 토큰을 받았으면 그 토큰을 그대로 쓴다
            if _token_cache["access_token"] == token:
                _token_cache["access_token"] = ""
                _token_cache["expires_at"] = 0.0
            token = await _get_access_token()
            resp = await client.get(f"{BASE_URL}{path}", headers={"Authorization": f"Bearer {token}"}, params=params)
        resp.raise_for_status()
        return resp.json()


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

    data = await _api_get("/api/v1/prices", {"symbols": ",".join(to_fetch)})

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

    data = await _api_get("/api/v1/candles", {"symbol": symbol, "interval": interval, "count": count})

    # 토스는 최신순(내림차순)으로 반환하므로, 차트 라이브러리가 기대하는 오름차순으로 뒤집는다
    candles = list(reversed(data["result"]["candles"]))
    _candle_cache[cache_key] = (candles, now)
    return candles


async def get_orderbook(symbol: str) -> dict:
    """종목의 호가(매도/매수 각 10단계)를 조회. asks는 낮은 가격부터, bids는 높은 가격부터
    (둘 다 현재가에 가까운 순서)이며 가격·잔량은 문자열로 온다."""
    now = time.monotonic()
    cached = _orderbook_cache.get(symbol)
    if cached and now - cached[1] < ORDERBOOK_CACHE_TTL_SECONDS:
        return cached[0]

    data = await _api_get("/api/v1/orderbook", {"symbol": symbol})

    _orderbook_cache[symbol] = (data["result"], now)
    return data["result"]


async def get_stock_info(symbol: str) -> dict | None:
    now = time.monotonic()
    cached = _stock_info_cache.get(symbol)
    if cached and now - cached[1] < STOCK_INFO_CACHE_TTL_SECONDS:
        return cached[0]

    data = await _api_get("/api/v1/stocks", {"symbols": symbol})

    info = next((item for item in data.get("result", []) if item["symbol"] == symbol), None)
    if info:
        _stock_info_cache[symbol] = (info, now)
    return info

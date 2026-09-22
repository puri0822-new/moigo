import asyncio
import time

import httpx

from app.core.config import settings

BASE_URL = "https://openapi.tossinvest.com"
PRICE_CACHE_TTL_SECONDS = 60

_token_lock = asyncio.Lock()
_token_cache: dict[str, str | float] = {"access_token": "", "expires_at": 0.0}

_price_cache: dict[str, tuple[dict, float]] = {}


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

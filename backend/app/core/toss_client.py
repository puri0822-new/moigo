import asyncio
import time
from datetime import date, datetime, timedelta, timezone

import httpx

from app.core.config import settings
from app.core.http import client

BASE_URL = "https://openapi.tossinvest.com"
PRICE_CACHE_TTL_SECONDS = 60
CANDLE_CACHE_TTL_SECONDS = 60
# 토스는 동시 요청을 한꺼번에 많이 보내면 사실상 줄 세워 처리해 오히려 느려진다
MAX_CONCURRENT_REQUESTS = 5
KST = timezone(timedelta(hours=9))

# 429(요청 한도 초과)를 받으면 잠깐 쉬었다가 재시도하는 대기 시간(초)
RATE_LIMIT_BACKOFF_SECONDS = (0.5, 1.0, 2.0)

_request_semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

_token_lock = asyncio.Lock()
_token_cache: dict[str, str | float] = {"access_token": "", "expires_at": 0.0}

_price_cache: dict[str, tuple[dict, float]] = {}
_candle_cache: dict[tuple[str, str, int], tuple[list[dict], float]] = {}
# 전일 종가는 하루 동안 바뀌지 않으므로 (종목코드, KST 날짜) 단위로 캐시
_prev_close_cache: dict[tuple[str, date], float] = {}


async def _get_access_token() -> str:
    now = time.monotonic()
    if _token_cache["access_token"] and now < _token_cache["expires_at"]:
        return _token_cache["access_token"]  # type: ignore[return-value]

    async with _token_lock:
        # 락 대기 중 다른 요청이 이미 갱신했을 수 있으니 재확인
        now = time.monotonic()
        if _token_cache["access_token"] and now < _token_cache["expires_at"]:
            return _token_cache["access_token"]  # type: ignore[return-value]

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


def _invalidate_token(stale_token: str) -> None:
    # 토스는 같은 키로 토큰이 새로 발급되면 이전 토큰을 무효화한다 (다른 서버/스크립트가 같은 키를 쓰는 경우 등).
    # 동시에 401을 받은 요청들이 각자 재발급하면 새 토큰끼리 서로를 무효화하므로, 아직 그 토큰을 들고 있을 때만 비운다.
    if _token_cache["access_token"] == stale_token:
        _token_cache["access_token"] = ""
        _token_cache["expires_at"] = 0.0


async def _api_get(path: str, params: dict) -> dict:
    """토스 API GET. 동시 요청 수를 제한하고, 429를 받으면 잠깐 대기 후 재시도하며,
    401을 받으면 토큰을 새로 받아 한 번 재시도한다."""
    token = await _get_access_token()
    token_refreshed = False
    backoffs = list(RATE_LIMIT_BACKOFF_SECONDS)
    while True:
        async with _request_semaphore:
            resp = await client.get(
                f"{BASE_URL}{path}", headers={"Authorization": f"Bearer {token}"}, params=params
            )
        if resp.status_code == httpx.codes.UNAUTHORIZED and not token_refreshed:
            _invalidate_token(token)
            token = await _get_access_token()
            token_refreshed = True
            continue
        if resp.status_code == httpx.codes.TOO_MANY_REQUESTS and backoffs:
            await asyncio.sleep(backoffs.pop(0))
            continue
        break
    resp.raise_for_status()
    return resp.json()


async def get_prices(symbols: list[str], force: bool = False) -> dict[str, dict]:
    """종목 코드 목록의 현재가를 조회. 60초 이내 조회한 종목은 캐시에서 반환.
    force=True면 캐시를 무시하고 전부 새로 조회한다 (백그라운드 갱신용)."""
    if not symbols:
        return {}

    now = time.monotonic()
    result: dict[str, dict] = {}
    to_fetch: list[str] = []

    for symbol in symbols:
        cached = _price_cache.get(symbol)
        if not force and cached and now - cached[1] < PRICE_CACHE_TTL_SECONDS:
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


async def get_candles(symbol: str, interval: str, count: int, force: bool = False) -> list[dict]:
    """종목의 캔들(OHLCV) 데이터를 조회. 오래된 봉부터 오름차순으로 반환. 60초간 캐시.
    force=True면 캐시를 무시하고 새로 조회한다 (백그라운드 동기화용)."""
    cache_key = (symbol, interval, count)
    now = time.monotonic()
    cached = _candle_cache.get(cache_key)
    if not force and cached and now - cached[1] < CANDLE_CACHE_TTL_SECONDS:
        return cached[0]

    data = await _api_get("/api/v1/candles", {"symbol": symbol, "interval": interval, "count": count})

    # 토스는 최신순(내림차순)으로 반환하므로, 차트 라이브러리가 기대하는 오름차순으로 뒤집는다
    candles = list(reversed(data["result"]["candles"]))
    _candle_cache[cache_key] = (candles, now)
    return candles


def _kst_date(candle: dict) -> date:
    return datetime.fromisoformat(candle["timestamp"]).astimezone(KST).date()


def _prev_close_from(symbol: str, candles: list[dict], today: date) -> float | None:
    # 장 시작 전에는 오늘 일봉이 아직 없어 마지막 봉이 곧 전일 봉이므로, 위치(candles[-2])가 아니라 날짜로 판별한다
    previous = [c for c in candles if _kst_date(c) < today]
    if not previous:
        return None
    prev_close = float(previous[-1]["closePrice"])
    _prev_close_cache[(symbol, today)] = prev_close
    return prev_close


async def get_prev_close(symbol: str) -> float | None:
    """등락률 계산용 전일 종가. 오늘(KST)보다 이전 날짜의 가장 최근 일봉 종가를 사용하며,
    하루 동안 바뀌지 않으므로 날짜 단위로 캐시한다. 조회 실패 시 캐시하지 않는다."""
    today = datetime.now(KST).date()
    cache_key = (symbol, today)
    if cache_key in _prev_close_cache:
        return _prev_close_cache[cache_key]

    return _prev_close_from(symbol, await get_candles(symbol, "1d", 2), today)


async def get_daily_snapshot(symbol: str) -> tuple[float | None, int | None]:
    """(전일 종가, 오늘 누적 거래량). 거래량은 계속 바뀌므로 캐시 없이 일봉을 새로 조회한다.
    장 시작 전처럼 오늘 일봉이 없으면 거래량은 None."""
    today = datetime.now(KST).date()
    candles = await get_candles(symbol, "1d", 2, force=True)
    todays = [c for c in candles if _kst_date(c) == today]
    volume = int(float(todays[-1]["volume"])) if todays else None
    return _prev_close_from(symbol, candles, today), volume


async def get_rankings(type_: str, market_country: str, duration: str, count: int = 100) -> dict[str, dict]:
    """랭킹 API로 다건 종목의 현재가·등락률·거래량을 한 번에 조회 (symbol을 키로 하는 dict).
    종목별로 캔들/현재가 API를 따로 호출하면 레이트리밋에 쉽게 걸리므로, 여러 종목을 한꺼번에
    봐야 할 때는 이 함수를 우선 사용한다. 백그라운드 동기화에서만 호출하므로 캐시하지 않는다."""
    data = await _api_get(
        "/api/v1/rankings",
        {"type": type_, "marketCountry": market_country, "duration": duration, "count": count},
    )
    return {item["symbol"]: item for item in data["result"]["rankings"]}

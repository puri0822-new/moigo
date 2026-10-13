import asyncio
import logging
import time
from collections import deque
from datetime import date, datetime, timedelta, timezone

import httpx

from app.core.config import settings
from app.core.http import client

logger = logging.getLogger(__name__)

BASE_URL = "https://openapi.tossinvest.com"
# 상세페이지가 3초마다 현재가를 다시 묻는다. 캐시가 폴링 주기와 같으면 경계에서 어떤 때는 캐시, 어떤 때는 새 값이 되므로 그보다 짧게 둔다.
PRICE_CACHE_TTL_SECONDS = 2
CANDLE_CACHE_TTL_SECONDS = 60
# 호가도 상세페이지가 3초마다 다시 묻는다. 여러 사용자가 같은 종목을 보고 있어도 토스 호출은 이 주기에 한 번으로 묶인다.
ORDERBOOK_CACHE_TTL_SECONDS = 2
# 종목 기본 정보(상장일, 상장주식수 등)는 거의 바뀌지 않는다
STOCK_INFO_CACHE_TTL_SECONDS = 3600
KST = timezone(timedelta(hours=9))

# 토스 캔들 API는 초당 20건이 한도다(그룹별 한도는 다를 수 있어 모든 호출을 한 줄로 세운다).
# 한도보다 낮게 잡아 이어 받기·동기화·페이지 로딩이 같은 1초에 겹쳐도 넘지 않게 한다.
MAX_REQUESTS_PER_SECOND = 16
MAX_429_RETRIES = 2

_token_lock = asyncio.Lock()
_throttle_lock = asyncio.Lock()
_request_times: deque[float] = deque()
_token_cache: dict[str, str | float] = {"access_token": "", "expires_at": 0.0}

_price_cache: dict[str, tuple[dict, float]] = {}
_candle_cache: dict[tuple[str, str, int], tuple[list[dict], float]] = {}
_orderbook_cache: dict[str, tuple[dict, float]] = {}
_stock_info_cache: dict[str, tuple[dict, float]] = {}
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


async def _throttle() -> None:
    """최근 1초 안에 나간 요청이 MAX_REQUESTS_PER_SECOND개 미만일 때만 통과시키고, 아니면 자리가 날 때까지 기다린다."""
    async with _throttle_lock:
        while True:
            now = time.monotonic()
            while _request_times and now - _request_times[0] >= 1.0:
                _request_times.popleft()
            if len(_request_times) < MAX_REQUESTS_PER_SECOND:
                _request_times.append(now)
                return
            await asyncio.sleep(1.0 - (now - _request_times[0]))


def _retry_delay(resp: httpx.Response) -> float:
    try:
        delay = float(resp.headers.get("retry-after", 1.0))
    except ValueError:
        delay = 1.0
    return min(max(delay, 0.2), 5.0)


async def _authed_get(path: str, params: dict) -> dict:
    """토큰을 붙여 GET.
    - 호출 전에 초당 호출 수 제한을 거친다.
    - 429면 retry-after만큼 기다렸다가 최대 MAX_429_RETRIES번 다시 시도한다.
    - 401이면 토큰 캐시를 버리고 새 토큰으로 한 번만 재시도한다
      (다른 곳에서 같은 클라이언트로 토큰을 새로 발급받으면 서버에 캐시된 토큰이 무효화될 수 있어서다)."""
    token_retried = False
    rate_retries = 0
    while True:
        await _throttle()
        token = await _get_access_token()
        resp = await client.get(
            f"{BASE_URL}{path}",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
        )
        if resp.status_code == 429:
            # 어느 한도 그룹에 걸렸는지 알 수 있게 응답 헤더를 같이 남긴다
            logger.warning(
                "토스 429 %s limit=%s remaining=%s reset=%s retry-after=%s (재시도 %d/%d)",
                path,
                resp.headers.get("x-ratelimit-limit"),
                resp.headers.get("x-ratelimit-remaining"),
                resp.headers.get("x-ratelimit-reset"),
                resp.headers.get("retry-after"),
                rate_retries,
                MAX_429_RETRIES,
            )
            if rate_retries < MAX_429_RETRIES:
                rate_retries += 1
                await asyncio.sleep(_retry_delay(resp))
                continue
        elif resp.status_code == 401 and not token_retried:
            _invalidate_token(token)
            token_retried = True
            continue
        resp.raise_for_status()
        return resp.json()


async def get_prices(symbols: list[str], force: bool = False) -> dict[str, dict]:
    """종목 코드 목록의 현재가를 조회. PRICE_CACHE_TTL_SECONDS 이내 조회한 종목은 캐시에서 반환.
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

    data = await _authed_get("/api/v1/prices", {"symbols": ",".join(to_fetch)})

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

    data = await _authed_get("/api/v1/candles", {"symbol": symbol, "interval": interval, "count": count})

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

    data = await _authed_get("/api/v1/orderbook", {"symbol": symbol})
    _orderbook_cache[symbol] = (data["result"], now)
    return data["result"]


async def get_stock_info(symbol: str) -> dict | None:
    """종목 기본 정보(영문명, ISIN, 상장일, 상장주식수, 거래 상태 등)를 조회. 1시간 캐시.
    토스에 없는 종목이면 None."""
    now = time.monotonic()
    cached = _stock_info_cache.get(symbol)
    if cached and now - cached[1] < STOCK_INFO_CACHE_TTL_SECONDS:
        return cached[0]

    data = await _authed_get("/api/v1/stocks", {"symbols": symbol})
    info = next((item for item in data.get("result", []) if item["symbol"] == symbol), None)
    if info:
        _stock_info_cache[symbol] = (info, now)
    return info


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


async def iter_daily_pages(symbol: str, first_count: int = 200, before: str | None = None):
    """일봉을 최신순 페이지 단위로 과거 방향으로 내보낸다(각 페이지도 최신순).
    토스는 한 번에 최대 200개라 응답의 nextBefore를 다음 요청의 before로 넘겨 이어 받는다.
    before는 해당 시각의 봉을 포함해서 그 이전 봉을 준다. 호출하는 쪽이 필요한 만큼만 받고 멈춘다."""
    count = first_count
    while True:
        params: dict = {"symbol": symbol, "interval": "1d", "count": count}
        if before:
            params["before"] = before
        data = await _authed_get("/api/v1/candles", params)
        result = data["result"]
        if not result["candles"]:
            return
        yield result["candles"]
        before = result.get("nextBefore")
        if not before:
            return
        count = 200


async def get_rankings(type_: str, market_country: str, duration: str, count: int = 100) -> dict[str, dict]:
    """랭킹 API로 다건 종목의 현재가·등락률·거래량을 한 번에 조회 (symbol을 키로 하는 dict).
    종목별로 캔들/현재가 API를 따로 호출하면 초당 레이트리밋(캔들 API 기준 20건/초)에 쉽게 걸리므로,
    여러 종목을 한꺼번에 봐야 할 때는 이 함수를 우선 사용한다. 백그라운드 동기화에서만 호출하므로 캐시하지 않는다."""
    data = await _authed_get(
        "/api/v1/rankings",
        {"type": type_, "marketCountry": market_country, "duration": duration, "count": count},
    )
    return {item["symbol"]: item for item in data["result"]["rankings"]}

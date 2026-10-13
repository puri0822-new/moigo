import asyncio
import time
from datetime import datetime

from app.core.http import client

# 토스 오픈 API에는 지수(코스피·코스닥)가 없어, 네이버 증권이 화면에 쓰는 비공식 API에서 가져온다.
# 공식 API가 아니라 예고 없이 바뀌거나 막힐 수 있다 (그때는 호출하는 쪽이 502로 응답한다).
POLLING_URL = "https://polling.finance.naver.com/api/realtime/domestic/index/{codes}"
INTRADAY_URL = "https://api.stock.naver.com/chart/domestic/index/{code}/minute10"
HEADERS = {"User-Agent": "Mozilla/5.0"}

INDEX_NAMES = {"KOSPI": "코스피", "KOSDAQ": "코스닥"}
CACHE_TTL_SECONDS = 10

_cache: tuple[list[dict], float] | None = None
_lock = asyncio.Lock()


async def _fetch_intraday(code: str, trade_date: str) -> list[float]:
    """해당 거래일의 10분 간격 지수 값 (장 시작부터 지금까지). trade_date는 YYYYMMDD."""
    resp = await client.get(
        INTRADAY_URL.format(code=code),
        params={"startDateTime": f"{trade_date}0900", "endDateTime": f"{trade_date}1540"},
        headers=HEADERS,
    )
    resp.raise_for_status()
    return [float(point["currentPrice"]) for point in resp.json()]


async def get_indices() -> list[dict]:
    """코스피·코스닥의 현재 값, 전일 대비, 당일 추이. 10초 캐시."""
    global _cache
    if _cache and time.monotonic() - _cache[1] < CACHE_TTL_SECONDS:
        return _cache[0]

    async with _lock:
        # 락 대기 중 다른 요청이 이미 갱신했을 수 있으니 재확인
        if _cache and time.monotonic() - _cache[1] < CACHE_TTL_SECONDS:
            return _cache[0]

        resp = await client.get(POLLING_URL.format(codes=",".join(INDEX_NAMES)), headers=HEADERS)
        resp.raise_for_status()
        items = {item["itemCode"]: item for item in resp.json()["datas"]}

        async def build(code: str) -> dict:
            item = items[code]
            value = float(item["closePriceRaw"])
            change = float(item["compareToPreviousClosePriceRaw"])
            # 주말·휴장일에는 마지막 거래일의 추이를 보여준다
            traded_at = datetime.fromisoformat(item["localTradedAt"])
            return {
                "code": code,
                "name": INDEX_NAMES[code],
                "value": value,
                "change": change,
                "change_rate": float(item["fluctuationsRatioRaw"]) / 100,
                "prev_close": value - change,
                "is_open": item.get("marketStatus") == "OPEN",
                "traded_at": traded_at,
                "spark": await _fetch_intraday(code, traded_at.strftime("%Y%m%d")),
            }

        indices = list(await asyncio.gather(*[build(code) for code in INDEX_NAMES]))
        _cache = (indices, time.monotonic())
        return indices

import asyncio

import httpx

from app.core import toss_client

# 캔들 API 레이트리밋(초당 20건)보다 여유있게 낮춰서, 동시 호출량이 절대 한도를 넘지 않도록 한다.
# 상세페이지 조회와 랭킹 캐시 동기화 작업이 동시에 호출량을 늘릴 수 있어 이 세마포어를 공유한다.
CANDLE_CONCURRENCY = asyncio.Semaphore(15)


async def fetch_prices_safe(codes: list[str]) -> dict[str, dict]:
    if not codes:
        return {}
    try:
        return await toss_client.get_prices(codes)
    except httpx.HTTPError:
        return {}


async def fetch_candle_info_safe(codes: list[str]) -> dict[str, dict]:
    """등락률/거래량 계산용 보조 데이터. 일봉 2개(전일/당일)를 조회해
    전일 종가(prev_close)와 당일 거래량(volume)을 함께 반환."""
    if not codes:
        return {}

    async def fetch_one(code: str) -> tuple[str, dict | None]:
        async with CANDLE_CONCURRENCY:
            try:
                candles = await toss_client.get_candles(code, "1d", 2)
            except httpx.HTTPError:
                return code, None
        if len(candles) < 2:
            return code, None
        return code, {
            "prev_close": float(candles[-2]["closePrice"]),
            "volume": float(candles[-1]["volume"]),
        }

    results = await asyncio.gather(*[fetch_one(c) for c in codes])
    return {code: info for code, info in results if info is not None}

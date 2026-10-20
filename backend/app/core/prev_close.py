"""등락률 기준이 되는 공식 전일 종가(정규장).

토스 API에는 기준가가 없고, 토스 일봉 종가는 넥스트레이드 애프터마켓까지 합친 값이라 공식 종가와 다르다
(예: SK하이닉스 공식 1,277,000원 / 토스 일봉 1,305,000원). 그래서 토스 앱·네이버와 같은 등락률을 내려면
네이버 증권의 "현재가 - 전일 대비"로 공식 전일 종가를 구한다. 실패한 종목은 토스 일봉의 앞 봉 종가로 대신한다.
"""

import asyncio
import logging
import time

import httpx

from app.core import toss_client

logger = logging.getLogger(__name__)

NAVER_URL = "https://m.stock.naver.com/api/stock/{code}/basic"
# 전일 종가는 장이 새로 열릴 때 바뀌므로 하루가 아니라 짧게 캐시한다
CACHE_TTL_SECONDS = 600
CONCURRENCY = 5

_cache: dict[str, tuple[float, float]] = {}  # code → (전일 종가, 저장 시각)


def _num(s: str) -> float:
    return float(str(s).replace(",", ""))


async def _from_naver(client: httpx.AsyncClient, sem: asyncio.Semaphore, code: str) -> float | None:
    async with sem:
        try:
            resp = await client.get(NAVER_URL.format(code=code))
            resp.raise_for_status()
            d = resp.json()
            prev = _num(d["closePrice"]) - _num(d["compareToPreviousClosePrice"])
        except (httpx.HTTPError, KeyError, ValueError) as e:
            logger.warning("네이버 전일 종가 조회 실패 %s: %r", code, e)
            return None
    return prev if prev > 0 else None


async def _from_toss_candles(code: str) -> float | None:
    try:
        candles = await toss_client.get_candles(code, "1d", 2)
    except httpx.HTTPError:
        return None
    return float(candles[-2]["closePrice"]) if len(candles) >= 2 else None


async def get_prev_closes(codes: list[str]) -> dict[str, float]:
    """종목 코드별 공식 전일 종가. 끝내 못 구한 종목은 빠진다."""
    now = time.monotonic()
    result = {c: _cache[c][0] for c in codes if c in _cache and now - _cache[c][1] < CACHE_TTL_SECONDS}
    missing = [c for c in codes if c not in result]
    if not missing:
        return result

    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(timeout=5, headers={"User-Agent": "Mozilla/5.0"}) as client:
        fetched = await asyncio.gather(*(_from_naver(client, sem, c) for c in missing))
    for code, prev in zip(missing, fetched):
        if prev is None:
            prev = await _from_toss_candles(code)
        else:
            _cache[code] = (prev, now)
        if prev is not None:
            result[code] = prev
    return result

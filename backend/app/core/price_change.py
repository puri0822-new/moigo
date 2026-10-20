import asyncio
from dataclasses import dataclass
from datetime import date

import httpx

from app.core import toss_client
from app.core.prev_close import get_prev_closes


@dataclass
class PriceChange:
    price: int
    change: int          # 전일 종가 대비 금액
    change_rate: float   # 전일 종가 대비 등락률(%)
    trade_date: date     # 현재가가 체결된 날짜 (주말에는 금요일)


async def get_price_changes(codes: list[str]) -> dict[str, PriceChange]:
    """종목별 현재가와 공식 전일 종가 대비 등락 (토스 앱·네이버와 같은 기준).
    현재가는 토스 현재가(정규장), 전일 종가는 prev_close 참고. 어느 쪽이든 못 구한 종목은 빠진다."""
    if not codes:
        return {}
    try:
        prices, prev_closes = await asyncio.gather(toss_client.get_prices(codes), get_prev_closes(codes))
    except httpx.HTTPError:
        return {}

    result: dict[str, PriceChange] = {}
    for code in codes:
        p, prev = prices.get(code), prev_closes.get(code)
        if not p or not prev:
            continue
        price = int(float(p["lastPrice"]))
        result[code] = PriceChange(
            price=price,
            change=int(price - prev),
            change_rate=(price - prev) / prev * 100,
            trade_date=date.fromisoformat(p["timestamp"][:10]),
        )
    return result

import asyncio
from dataclasses import dataclass
from datetime import date

import httpx

from app.core import toss_client


@dataclass
class PriceChange:
    price: int
    change: int          # 전일 종가 대비 금액
    change_rate: float   # 전일 종가 대비 등락률(%)
    trade_date: date     # 최신 일봉의 날짜 (주말에는 금요일)


async def get_price_changes(codes: list[str]) -> dict[str, PriceChange]:
    """종목별 현재가와 전일 종가 대비 등락. 일봉 2개(전일/최신)로 계산하고, 토스 조회에 실패한 종목은 빠진다."""

    async def fetch_one(code: str) -> tuple[str, PriceChange | None]:
        try:
            candles = await toss_client.get_candles(code, "1d", 2)
        except httpx.HTTPError:
            return code, None
        if len(candles) < 2:
            return code, None
        prev_close = float(candles[-2]["closePrice"])
        price = int(float(candles[-1]["closePrice"]))
        if prev_close <= 0:
            return code, None
        return code, PriceChange(
            price=price,
            change=int(price - prev_close),
            change_rate=(price - prev_close) / prev_close * 100,
            trade_date=date.fromisoformat(candles[-1]["timestamp"][:10]),
        )

    results = await asyncio.gather(*[fetch_one(c) for c in codes])
    return {code: pc for code, pc in results if pc is not None}

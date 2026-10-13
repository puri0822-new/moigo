import asyncio

import httpx
from fastapi import APIRouter

from app.schemas.common import ApiResponse

router = APIRouter(prefix="/market", tags=["Market"])


def _parse_price(s: str) -> float:
    return float(s.replace(",", ""))


@router.get("/indices", response_model=ApiResponse[list[dict]])
async def get_market_indices():
    indices = []
    async with httpx.AsyncClient(timeout=5) as client:
        for code in ["KOSPI", "KOSDAQ"]:
            try:
                basic_resp, price_resp = await asyncio.gather(
                    client.get(f"https://m.stock.naver.com/api/index/{code}/basic"),
                    client.get(f"https://m.stock.naver.com/api/index/{code}/price?range=1M"),
                )
                basic_resp.raise_for_status()
                d = basic_resp.json()

                spark: list[float] = []
                if price_resp.status_code == 200:
                    prices = price_resp.json()
                    spark = [_parse_price(p["closePrice"]) for p in reversed(prices[-12:])]

                indices.append({
                    "name": d.get("stockName", code),
                    "value": d.get("closePrice", "-"),
                    "changePoint": d.get("compareToPreviousClosePrice", "0"),
                    "changePct": float(d.get("fluctuationsRatio", 0)),
                    "spark": spark,
                })
            except (httpx.HTTPError, ValueError):
                indices.append({"name": code, "value": "-", "changePoint": "0", "changePct": 0.0, "spark": []})
    return ApiResponse(success=True, data=indices, message="요청 성공")

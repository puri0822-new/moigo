import asyncio
import logging

import httpx
from fastapi import APIRouter, HTTPException

from app.core import naver_index
from app.schemas.common import ApiResponse
from app.schemas.market import MarketIndex

router = APIRouter(prefix="/market", tags=["Market"])
logger = logging.getLogger("uvicorn.error")

INDEX_TIMEOUT_SECONDS = 6


@router.get("/indices", response_model=ApiResponse[list[MarketIndex]])
async def get_market_indices():
    """코스피·코스닥 지수."""
    try:
        indices = await asyncio.wait_for(naver_index.get_indices(), INDEX_TIMEOUT_SECONDS)
    except (httpx.HTTPError, asyncio.TimeoutError, KeyError, ValueError) as e:
        # 비공식 API라 응답 형식이 바뀌는 경우(KeyError/ValueError)도 조회 실패로 다룬다
        logger.warning("지수 조회 실패: %r", e)
        raise HTTPException(status_code=502, detail="지수를 불러오지 못했습니다")

    return ApiResponse(success=True, data=[MarketIndex(**index) for index in indices], message="요청 성공")

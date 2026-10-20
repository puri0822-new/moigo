from collections import defaultdict

import httpx

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import llm, stock_reason, toss_client
from app.database import get_db
from app.models.ai_recommendation import AiModel, AiRecommendation, AiRecommendationEvidence, AiRecommendationResult
from app.models.stock import Stock
from app.schemas.ai import AiEvidenceItem, AiModelItem, AiRecommendationItem, AiResultItem, StockAiReasonItem
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/ai", tags=["AI"])


@router.get("/models", response_model=ApiResponse[list[AiModelItem]])
def list_ai_models(db: Session = Depends(get_db)):
    # 중단된 모델도 지난 성적표에는 남아야 하므로 모두 내려준다. 화면에서 is_active로 구분한다
    # 키가 없어 추천을 만들 수 없는 모델도 새 추천 화면에서는 숨기도록 is_active를 끈다
    models = db.execute(select(AiModel).order_by(AiModel.sort_order, AiModel.code)).scalars().all()
    data = [
        AiModelItem.model_validate(m).model_copy(update={"is_active": m.is_active and llm.is_available(m.code)})
        for m in models
    ]
    return ApiResponse(success=True, data=data, message="요청 성공")


@router.get("/recommendations", response_model=ApiResponse[list[AiRecommendationItem]])
async def list_recommendations(db: Session = Depends(get_db)):
    """모든 AI 추천과 근거 뉴스, 검증 결과. 결과가 없으면 아직 검증 전인 추천이다."""
    rows = (
        db.query(AiRecommendation, Stock, AiRecommendationResult)
        .join(Stock, Stock.id == AiRecommendation.stock_id)
        .outerjoin(AiRecommendationResult, AiRecommendationResult.recommendation_id == AiRecommendation.id)
        .order_by(AiRecommendation.recommended_at.desc(), AiRecommendation.id)
        .all()
    )
    evidence: dict[int, list[AiEvidenceItem]] = defaultdict(list)
    if rows:
        ev_rows = (
            db.query(AiRecommendationEvidence)
            .filter(AiRecommendationEvidence.recommendation_id.in_([r.id for r, _, _ in rows]))
            .order_by(AiRecommendationEvidence.id)
            .all()
        )
        for ev in ev_rows:
            evidence[ev.recommendation_id].append(AiEvidenceItem.model_validate(ev))

    # 아직 결과가 나오지 않은 추천은 지금 현재가로 중간 집계를 붙인다 (토스 현재가는 60초 캐시)
    pending_codes = sorted({stock.code for _, stock, result in rows if result is None})
    try:
        prices = await toss_client.get_prices(pending_codes) if pending_codes else {}
    except httpx.HTTPError:
        prices = {}

    def live(rec: AiRecommendation, stock: Stock, result) -> dict:
        p = prices.get(stock.code) if result is None else None
        if not p:
            return {}
        price = int(float(p["lastPrice"]))
        return {"live_price": price, "live_return_rate": round((price - rec.price_at_recommendation) / rec.price_at_recommendation, 4)}

    data = [
        AiRecommendationItem(
            id=rec.id, ai_model=rec.ai_model, period_type=rec.period_type,
            stock_code=stock.code, stock_name=stock.name, sector=stock.sector,
            opinion=rec.opinion, reason=rec.reason, summary=rec.summary, confidence=rec.confidence,
            price_at_recommendation=rec.price_at_recommendation,
            recommended_at=rec.recommended_at, evaluate_at=rec.evaluate_at,
            evidence=evidence[rec.id],
            result=AiResultItem.model_validate(result) if result else None,
            **live(rec, stock, result),
        )
        for rec, stock, result in rows
    ]
    return ApiResponse(success=True, data=data, message="요청 성공")


@router.get("/stocks/{code}/reason", response_model=ApiResponse[StockAiReasonItem | None])
async def get_stock_reason(code: str, db: Session = Depends(get_db)):
    """종목 상세의 AI 등락 이유. 없거나 오래됐으면 이 요청에서 AI가 새로 쓴다 (몇 초 걸릴 수 있음)."""
    stock = db.query(Stock).filter(Stock.code == code).first()
    if not stock:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")
    row = await stock_reason.get_reason(db, stock)
    data = StockAiReasonItem.model_validate(row) if row else None
    return ApiResponse(success=True, data=data, message="요청 성공")

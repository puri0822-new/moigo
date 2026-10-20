from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import llm
from app.database import get_db
from app.models.ai_recommendation import AiModel, AiRecommendation, AiRecommendationEvidence, AiRecommendationResult
from app.models.stock import Stock
from app.schemas.ai import AiEvidenceItem, AiModelItem, AiRecommendationItem, AiResultItem
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
def list_recommendations(db: Session = Depends(get_db)):
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

    data = [
        AiRecommendationItem(
            id=rec.id, ai_model=rec.ai_model, period_type=rec.period_type,
            stock_code=stock.code, stock_name=stock.name, sector=stock.sector,
            opinion=rec.opinion, reason=rec.reason, summary=rec.summary, confidence=rec.confidence,
            price_at_recommendation=rec.price_at_recommendation,
            recommended_at=rec.recommended_at, evaluate_at=rec.evaluate_at,
            evidence=evidence[rec.id],
            result=AiResultItem.model_validate(result) if result else None,
        )
        for rec, stock, result in rows
    ]
    return ApiResponse(success=True, data=data, message="요청 성공")

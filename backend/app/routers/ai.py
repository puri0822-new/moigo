from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.ai_recommendation import AiModel
from app.schemas.ai import AiModelItem
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/ai", tags=["AI"])


@router.get("/models", response_model=ApiResponse[list[AiModelItem]])
def list_ai_models(db: Session = Depends(get_db)):
    # 중단된 모델도 지난 성적표에는 남아야 하므로 모두 내려준다. 화면에서 is_active로 구분한다
    models = db.execute(select(AiModel).order_by(AiModel.sort_order, AiModel.code)).scalars().all()
    data = [AiModelItem.model_validate(m) for m in models]
    return ApiResponse(success=True, data=data, message="요청 성공")

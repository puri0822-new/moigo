from datetime import date, datetime

from pydantic import BaseModel


class AiModelItem(BaseModel):
    code: str
    display_name: str
    provider: str
    color: str
    is_active: bool

    model_config = {"from_attributes": True}


class AiEvidenceItem(BaseModel):
    title: str
    source: str | None
    url: str | None
    published_at: datetime | None
    insight: str

    model_config = {"from_attributes": True}


class AiResultItem(BaseModel):
    price_at_evaluation: int
    # (검증가 - 추천가) / 추천가. 0.0123 = +1.23%
    return_rate: float
    is_hit: bool
    failure_reason: str | None
    evaluated_at: datetime

    model_config = {"from_attributes": True}


class AiRecommendationItem(BaseModel):
    id: int
    ai_model: str
    period_type: str
    stock_code: str
    stock_name: str
    sector: str | None
    opinion: str
    reason: str
    summary: str | None
    confidence: int | None
    price_at_recommendation: int
    recommended_at: datetime
    evaluate_at: datetime
    evidence: list[AiEvidenceItem]
    # 검증 전이면 None
    result: AiResultItem | None
    # 검증 전 추천의 중간 집계: 지금 현재가와 추천가 대비 수익률(0.0123 = +1.23%). 검증 끝났거나 시세를 못 받으면 None
    live_price: int | None = None
    live_return_rate: float | None = None


class StockAiReasonItem(BaseModel):
    ai_model: str
    trade_date: date
    change_rate: float
    reason: str
    created_at: datetime

    model_config = {"from_attributes": True}

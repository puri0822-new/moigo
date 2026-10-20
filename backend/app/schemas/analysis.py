from datetime import datetime

from pydantic import BaseModel


class AnalysisNewsItem(BaseModel):
    id: int
    title: str
    source: str | None
    published_at: datetime
    url: str | None = None


class AiAnalysisData(BaseModel):
    id: int
    stock_id: int
    gemini_result: str | None
    gpt_result: str | None
    clova_result: str | None
    gemini_recommendation: str | None
    gpt_recommendation: str | None
    clova_recommendation: str | None
    is_matched: bool | None
    sentiment: str | None
    price_at_analysis: int | None
    analyzed_at: datetime
    related_news: list[AnalysisNewsItem]


class AiAnalysisCreated(BaseModel):
    id: int
    stock_id: int
    analyzed_at: datetime

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class RankingAiInsight(BaseModel):
    bot: Literal["Gemini", "GPT", "CLOVA"]
    recommendation: Literal["BUY", "HOLD", "SELL"]
    summary: str


class RankingAiSummary(BaseModel):
    sentiment: str | None
    is_matched: bool | None
    analyzed_at: datetime
    insights: list[RankingAiInsight]


class StockRankingItem(BaseModel):
    rank: int | None  # 거래대금 상위 100위 밖이면 실제 순위가 없어 None
    id: int
    code: str
    name: str
    market: str
    sector: str | None
    current_price: int | None
    change_rate: float | None
    trading_volume: int | None
    trading_amount: int | None
    ai: RankingAiSummary | None = None

from pydantic import BaseModel


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

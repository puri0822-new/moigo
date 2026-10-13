from datetime import datetime

from pydantic import BaseModel


class StockListItem(BaseModel):
    id: int
    code: str
    name: str
    market: str
    sector: str | None
    current_price: int | None = None
    change_rate: float | None = None
    volume: int | None = None

    model_config = {"from_attributes": True}


class StockDetail(StockListItem):
    created_at: datetime
    volume: int | None = None

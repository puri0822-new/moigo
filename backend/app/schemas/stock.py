from datetime import datetime

from pydantic import BaseModel


class StockListItem(BaseModel):
    id: int
    code: str
    name: str
    market: str
    sector: str | None
    # TODO: 토스증권 API 연동 후 채우기 (현재는 DB에 시세 데이터가 없어 항상 None)
    current_price: int | None = None
    change_rate: float | None = None

    model_config = {"from_attributes": True}


class StockDetail(StockListItem):
    created_at: datetime
    volume: int | None = None

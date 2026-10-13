from datetime import datetime

from pydantic import BaseModel


class OrderbookLevel(BaseModel):
    price: int
    volume: int


class Orderbook(BaseModel):
    timestamp: datetime
    # 둘 다 현재가에 가까운 호가부터: asks는 낮은 가격순, bids는 높은 가격순
    asks: list[OrderbookLevel]
    bids: list[OrderbookLevel]

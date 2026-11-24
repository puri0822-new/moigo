from typing import Literal

from pydantic import BaseModel, Field
from datetime import datetime


class OrderRequest(BaseModel):
    stock_id: int
    order_type: Literal["BUY", "SELL"]
    price_type: Literal["MARKET", "LIMIT"] = "MARKET"
    quantity: int = Field(gt=0)
    # 지정가 주문일 때의 한도 가격. 체결가는 서버가 호가로 정한다.
    price: int | None = Field(default=None, gt=0)
    ai_analysis_id: int | None = None


class OrderResponse(BaseModel):
    id: int
    stock_name: str
    stock_code: str
    order_type: str
    price_type: str
    status: str
    quantity: int
    filled_quantity: int
    price: int
    total_amount: int
    limit_price: int | None
    ordered_at: datetime
    filled_at: datetime | None


class HoldingResponse(BaseModel):
    stock_id: int
    stock_name: str
    stock_code: str
    quantity: int
    avg_price: int
    current_price: int | None = None
    eval_amount: int | None = None
    profit_loss: int | None = None
    profit_loss_rate: float | None = None


class PortfolioResponse(BaseModel):
    balance: int
    total_eval_amount: int
    total_profit_loss: int
    total_profit_loss_rate: float
    holdings: list[HoldingResponse]

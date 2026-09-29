from pydantic import BaseModel
from datetime import datetime

class OrderRequest(BaseModel):
    stock_id: int
    order_type: str       # BUY / SELL
    quantity: int
    price: int            # 현재가 (프론트에서 전달, 추후 증권 API로 대체)
    ai_analysis_id: int | None = None

class OrderResponse(BaseModel):
    id: int
    stock_id: int
    stock_name: str
    order_type: str
    quantity: int
    price: int
    total_amount: int
    ordered_at: datetime

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

from datetime import date

from pydantic import BaseModel


class StockInfo(BaseModel):
    english_name: str | None
    isin_code: str | None
    market: str | None
    security_type: str | None  # STOCK 등
    is_common_share: bool | None  # 보통주 여부 (False면 우선주 등)
    status: str | None  # ACTIVE 등
    currency: str | None
    list_date: date | None
    shares_outstanding: int | None  # 상장주식수. 시가총액은 여기에 현재가를 곱해 구한다
    nxt_supported: bool | None  # 대체거래소(NXT) 거래 가능 여부
    trading_suspended: bool | None  # KRX 거래정지 여부

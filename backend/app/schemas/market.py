from datetime import datetime

from pydantic import BaseModel


class MarketIndex(BaseModel):
    code: str  # KOSPI / KOSDAQ
    name: str
    value: float
    change: float  # 전일 대비 포인트
    change_rate: float  # 전일 대비 등락률 (0.01 = 1%)
    prev_close: float
    is_open: bool  # 지금 장중인지
    traded_at: datetime
    spark: list[float]  # 당일(휴장일이면 마지막 거래일) 10분 간격 추이

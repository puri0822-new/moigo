from datetime import date

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class StockDailyCandle(Base):
    __tablename__ = "stock_daily_candles"
    __table_args__ = (UniqueConstraint("stock_id", "trade_date", name="stock_daily_candles_stock_id_trade_date_key"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    stock_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    open_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    high_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    low_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    close_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    volume: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

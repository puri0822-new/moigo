from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class StockPriceCache(Base):
    __tablename__ = "stock_price_cache"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    stock_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stocks.id", ondelete="CASCADE"), unique=True, nullable=False)
    current_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    change_rate: Mapped[float | None] = mapped_column(Numeric(10, 6), nullable=True)
    trading_volume: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    trading_amount: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    market_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fetched_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

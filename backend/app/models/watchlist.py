from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Watchlist(Base):
    __tablename__ = "watchlist"
    __table_args__ = (UniqueConstraint("user_id", "stock_id", name="watchlist_user_id_stock_id_key"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    stock_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    # 이 종목의 급등락 알림을 받을지 (하트를 누를 때 묻는다)
    alert_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "stock_id", "trade_date", "direction", "level",
            name="notifications_user_id_stock_id_trade_date_direction_level_key",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    stock_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    direction: Mapped[str] = mapped_column(String(4), nullable=False)  # UP / DOWN
    # 넘은 단계(5, 10, 15...). 같은 날 같은 단계는 한 번만 알린다
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    change_rate: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # 사용자가 지운 알림. 행을 지우면 같은 날 같은 단계 알림이 다시 만들어지므로 표시만 한다
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

from sqlalchemy import BigInteger, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    stock_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    ai_analysis_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # TODO: FK to ai_analyses when model is ready
    order_type: Mapped[str] = mapped_column(String(10), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    total_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    ordered_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.now())

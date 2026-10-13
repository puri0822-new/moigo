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
    price_type: Mapped[str] = mapped_column(String(10), nullable=False, server_default="MARKET")  # MARKET / LIMIT
    # PENDING(미체결) / FILLED(체결) / CANCELLED(취소) / EXPIRED(장 마감으로 만료)
    status: Mapped[str] = mapped_column(String(10), nullable=False, server_default="FILLED")
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    limit_price: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # 지정가 주문의 지정가
    # 체결된 주문은 평균 체결가와 실제 체결 금액, 미체결 주문은 지정가와 지정가 기준 금액
    price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    total_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    ordered_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    filled_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

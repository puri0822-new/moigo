from sqlalchemy import BigInteger, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    stock_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    ai_analysis_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    order_type: Mapped[str] = mapped_column(String(10), nullable=False)
    # MARKET / LIMIT
    price_type: Mapped[str] = mapped_column(String(10), nullable=False, server_default="MARKET")
    # PENDING / FILLED / CANCELLED / EXPIRED
    status: Mapped[str] = mapped_column(String(10), nullable=False, server_default="FILLED")
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    limit_price: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    # 체결된 주문(또는 일부 체결)의 평균 체결가. 미체결이면 지정가
    price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    # 미체결이면 지정가×수량, 체결되면 실제 체결 금액 합
    total_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    # 부분 체결: 지금까지 체결된 수량·금액
    filled_quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    filled_amount: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    # 매수 예약으로 잔고에서 미리 빼 둔 금액(미체결분). 체결·취소·만료 때 줄이거나 환불한다
    escrow_amount: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    ordered_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    filled_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

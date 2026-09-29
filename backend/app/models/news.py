from sqlalchemy import BigInteger, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class News(Base):
    __tablename__ = "news"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    stock_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    published_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False)
    collected_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.now())

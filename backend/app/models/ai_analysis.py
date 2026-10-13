from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class AiAnalysis(Base):
    __tablename__ = "ai_analyses"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    stock_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    gemini_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    claude_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    gemini_recommendation: Mapped[str | None] = mapped_column(String(20), nullable=True)
    claude_recommendation: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_matched: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    sentiment: Mapped[str | None] = mapped_column(String(20), nullable=True)
    price_at_analysis: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    analyzed_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.now())


class AiAnalysisNews(Base):
    __tablename__ = "ai_analysis_news"

    ai_analysis_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("ai_analyses.id", ondelete="CASCADE"), primary_key=True)
    news_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("news.id", ondelete="CASCADE"), primary_key=True)

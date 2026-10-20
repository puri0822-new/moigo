from datetime import date

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class AiModel(Base):
    """추천을 내는 AI 모델. 모델을 추가·중단할 때 코드를 고치지 않고 이 테이블만 바꾼다"""
    __tablename__ = "ai_models"

    code: Mapped[str] = mapped_column(String(30), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(50), nullable=False)
    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    # API 호출에 쓰는 모델 ID. 추천 생성을 붙일 때 채운다
    model_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    color: Mapped[str] = mapped_column(String(7), nullable=False)
    # FALSE면 새 추천을 만들지 않는다 (지난 성적은 남는다)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AiRecommendation(Base):
    __tablename__ = "ai_recommendations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # 추천한 AI (ai_models.code)
    ai_model: Mapped[str] = mapped_column(String(30), ForeignKey("ai_models.code"), nullable=False)
    # WEEKLY는 1주 뒤, MONTHLY는 1달 뒤에 검증한다
    period_type: Mapped[str] = mapped_column(String(10), nullable=False)
    stock_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    # BUY는 오르면 적중, SELL은 떨어지면 적중
    opinion: Mapped[str] = mapped_column(String(10), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    # 대시보드 종목명 옆에 보여줄 25자 안팎 한 줄 요약
    summary: Mapped[str | None] = mapped_column(String(100), nullable=True)
    confidence: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    price_at_recommendation: Mapped[int] = mapped_column(BigInteger, nullable=False)
    recommended_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    evaluate_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)


class AiRecommendationResult(Base):
    __tablename__ = "ai_recommendation_results"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    recommendation_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("ai_recommendations.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    price_at_evaluation: Mapped[int] = mapped_column(BigInteger, nullable=False)
    # (검증가 - 추천가) / 추천가. 0.0123 = +1.23%
    return_rate: Mapped[float] = mapped_column(Numeric(8, 4), nullable=False)
    is_hit: Mapped[bool] = mapped_column(Boolean, nullable=False)
    # 틀렸을 때 AI가 뉴스를 근거로 설명한 이유
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    evaluated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AiRecommendationEvidence(Base):
    __tablename__ = "ai_recommendation_evidence"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    recommendation_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("ai_recommendations.id", ondelete="CASCADE"), nullable=False
    )
    # 근거로 쓴 뉴스
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    published_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # 이 뉴스가 추천에 어떻게 반영됐는지 AI가 쓴 한 줄
    insight: Mapped[str] = mapped_column(Text, nullable=False)


class StockAiReason(Base):
    """종목 상세의 AI 등락 이유. 종목·거래일마다 한 줄, 장중에는 1시간마다 새로 쓴다"""
    __tablename__ = "stock_ai_reasons"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    stock_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    ai_model: Mapped[str] = mapped_column(String(30), ForeignKey("ai_models.code"), nullable=False)
    change_rate: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

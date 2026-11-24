from sqlalchemy import BigInteger, String, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    # 프로필 사진 서버 경로 (/uploads/avatars/...). 없으면 화면에서 이니셜을 쓴다
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    login_type: Mapped[str] = mapped_column(String(20), nullable=False, default="LOCAL")
    social_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    marketing_agreed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # 회원 설정의 급등락 알림 전체 스위치. 끄면 새 알림을 만들지 않는다
    price_alert_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # 전시용 체험 계정. 랭킹·피드에서 닉네임 옆에 "체험"을 붙인다
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

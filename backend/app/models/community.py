from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # 특정 종목에 대한 글이면 그 종목 (종목 상세의 커뮤니티 탭에 모아 보여준다). 자유 글이면 NULL
    stock_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("stocks.id", ondelete="SET NULL"), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # 붙인 사진의 서버 경로(/uploads/posts/...). 없으면 NULL
    image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="post_likes_post_id_user_id_key"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PostComment(Base):
    __tablename__ = "post_comments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings

# async URL(postgresql+asyncpg://)에서 sync URL(postgresql+psycopg2://)로 변환
# (드라이버를 명시하지 않으면 SQLAlchemy 2.1부터 기본값이 psycopg(v3)로 바뀌어 설치된 psycopg2를 못 쓴다)
_sync_url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2")
engine = create_engine(_sync_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

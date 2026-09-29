from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings

# async URL(postgresql+asyncpg://)에서 sync URL(postgresql://)로 변환
_sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
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

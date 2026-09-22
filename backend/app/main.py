from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import auth
from app.routers import orders, portfolio, account, stocks
import app.models.stock
import app.models.order
import app.models.holding

# 테이블 자동 생성
Base.metadata.create_all(bind=engine)

app = FastAPI(title="모이고 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/v1")
app.include_router(orders.router, prefix="/v1")
app.include_router(portfolio.router, prefix="/v1")
app.include_router(account.router, prefix="/v1")
app.include_router(stocks.router, prefix="/v1")

@app.get("/")
def root():
    return {"message": "모이고 API 서버"}

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.uploads import UPLOAD_DIR, UPLOAD_URL_PREFIX
from app.routers import auth, orders, portfolio, account, stocks, market, ranking, community, ai, users, watchlist, notifications

app = FastAPI(title="모이고 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "data": None, "message": exc.detail},
    )


@app.get("/health")
async def health():
    return {"success": True, "data": None, "message": "ok"}


@app.get("/")
def root():
    return {"message": "모이고 API 서버"}


app.include_router(auth.router, prefix="/v1")
app.include_router(orders.router, prefix="/v1")
app.include_router(portfolio.router, prefix="/v1")
app.include_router(account.router, prefix="/v1")
app.include_router(stocks.router, prefix="/v1")
app.include_router(market.router, prefix="/v1")
app.include_router(ranking.router, prefix="/v1")
app.include_router(community.router, prefix="/v1")
app.include_router(ai.router, prefix="/v1")
app.include_router(users.router, prefix="/v1")
app.include_router(watchlist.router, prefix="/v1")
app.include_router(notifications.router, prefix="/v1")

UPLOAD_DIR.mkdir(exist_ok=True)
app.mount(UPLOAD_URL_PREFIX, StaticFiles(directory=UPLOAD_DIR), name="uploads")

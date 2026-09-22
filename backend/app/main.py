from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import auth, stocks

app = FastAPI(title="모이고 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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


app.include_router(auth.router, prefix="/v1")
app.include_router(stocks.router, prefix="/v1")

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.stock import Stock

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("")
def get_stocks(db: Session = Depends(get_db)):
    stocks = db.query(Stock).order_by(Stock.id).all()
    return {
        "success": True,
        "data": [
            {
                "id": s.id,
                "code": s.code,
                "name": s.name,
                "market": s.market,
                "sector": s.sector,
            }
            for s in stocks
        ],
        "message": "요청 성공",
    }

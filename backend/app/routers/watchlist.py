from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.price_change import get_price_changes
from app.database import get_db
from app.models.stock import Stock
from app.models.user import User
from app.models.watchlist import Watchlist

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


class WatchlistAddRequest(BaseModel):
    stock_id: int
    alert_enabled: bool = False


class WatchlistUpdateRequest(BaseModel):
    alert_enabled: bool


@router.get("")
async def list_watchlist(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (
        db.query(Watchlist, Stock)
        .join(Stock, Stock.id == Watchlist.stock_id)
        .filter(Watchlist.user_id == current_user.id)
        .order_by(Watchlist.created_at.desc())
        .all()
    )
    changes = await get_price_changes([s.code for _, s in rows])

    items = []
    for w, s in rows:
        pc = changes.get(s.code)
        items.append({
            "stock_id": s.id,
            "stock_code": s.code,
            "stock_name": s.name,
            "alert_enabled": w.alert_enabled,
            "current_price": pc.price if pc else None,
            "change": pc.change if pc else None,
            "change_rate": round(pc.change_rate, 2) if pc else None,
        })

    return {
        "success": True,
        # 회원 설정에서 알림을 껐으면 하트를 눌러도 알림 여부를 묻지 않는다
        "data": {"price_alert_enabled": current_user.price_alert_enabled, "items": items},
        "message": "요청 성공",
    }


@router.post("")
def add_watchlist(body: WatchlistAddRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not db.get(Stock, body.stock_id):
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")
    db.execute(
        pg_insert(Watchlist)
        .values(user_id=current_user.id, stock_id=body.stock_id, alert_enabled=body.alert_enabled)
        .on_conflict_do_nothing(index_elements=["user_id", "stock_id"])
    )
    db.commit()
    return {"success": True, "data": None, "message": "관심 종목에 추가했습니다"}


@router.patch("/{stock_id}")
def update_watchlist(stock_id: int, body: WatchlistUpdateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(Watchlist).filter(Watchlist.user_id == current_user.id, Watchlist.stock_id == stock_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="관심 종목이 아닙니다")
    item.alert_enabled = body.alert_enabled
    db.commit()
    return {"success": True, "data": None, "message": "변경했습니다"}


@router.delete("/{stock_id}")
def remove_watchlist(stock_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Watchlist).filter(Watchlist.user_id == current_user.id, Watchlist.stock_id == stock_id).delete()
    db.commit()
    return {"success": True, "data": None, "message": "관심 종목에서 뺐습니다"}

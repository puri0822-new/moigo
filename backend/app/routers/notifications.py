from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.stock import Stock
from app.models.user import User
from app.models.watchlist import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])

LIST_LIMIT = 30


def _load_notifications(db: Session, user_id: int) -> dict:
    rows = (
        db.query(Notification, Stock)
        .join(Stock, Stock.id == Notification.stock_id)
        .filter(Notification.user_id == user_id, Notification.deleted_at.is_(None))
        .order_by(Notification.created_at.desc())
        .limit(LIST_LIMIT)
        .all()
    )
    unread_count = (
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == user_id, Notification.read_at.is_(None), Notification.deleted_at.is_(None))
        .scalar()
    )
    return {
        "unread_count": unread_count,
        "items": [
            {
                "id": n.id,
                "stock_code": s.code,
                "stock_name": s.name,
                "direction": n.direction,
                "level": n.level,
                "change_rate": float(n.change_rate),
                "price": n.price,
                "created_at": n.created_at,
                "read": n.read_at is not None,
            }
            for n, s in rows
        ],
    }


@router.get("")
def list_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 알림은 백그라운드(app.core.price_alerts)에서 만들어지므로 여기서는 읽기만 한다
    return {"success": True, "data": _load_notifications(db, current_user.id), "message": "요청 성공"}


@router.post("/read-all")
def read_all(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(
        Notification.user_id == current_user.id, Notification.read_at.is_(None)
    ).update({Notification.read_at: func.now()})
    db.commit()
    return {"success": True, "data": None, "message": "모두 읽음으로 표시했습니다"}


@router.delete("")
def delete_all(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(
        Notification.user_id == current_user.id, Notification.deleted_at.is_(None)
    ).update({Notification.deleted_at: func.now()})
    db.commit()
    return {"success": True, "data": None, "message": "알림을 모두 지웠습니다"}


@router.delete("/{notification_id}")
def delete_one(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(
        Notification.id == notification_id, Notification.user_id == current_user.id
    ).update({Notification.deleted_at: func.now()})
    db.commit()
    return {"success": True, "data": None, "message": "알림을 지웠습니다"}

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.price_change import get_price_changes
from app.database import get_db
from app.models.stock import Stock
from app.models.user import User
from app.models.watchlist import Notification, Watchlist

router = APIRouter(prefix="/notifications", tags=["notifications"])

ALERT_STEP = 5   # ±5%, ±10%, ±15%... 단계를 넘을 때마다 알린다
LIST_LIMIT = 30


async def _detect_price_alerts(db: Session, user: User) -> None:
    """알림을 켠 관심 종목의 등락률이 새 단계를 넘었으면 알림을 만든다.
    백그라운드 작업 없이 헤더가 알림 목록을 불러올 때(30초마다) 계산하므로, 접속하지 않은 동안의 등락은 놓칠 수 있다."""
    if not user.price_alert_enabled:
        return
    rows = (
        db.query(Stock)
        .join(Watchlist, Watchlist.stock_id == Stock.id)
        .filter(Watchlist.user_id == user.id, Watchlist.alert_enabled.is_(True))
        .all()
    )
    if not rows:
        return
    changes = await get_price_changes([s.code for s in rows])

    for s in rows:
        pc = changes.get(s.code)
        if not pc:
            continue
        level = int(abs(pc.change_rate) // ALERT_STEP) * ALERT_STEP
        if level < ALERT_STEP:
            continue
        # 한 번에 여러 단계를 건너뛰면 가장 높은 단계 하나만 알린다
        db.execute(
            pg_insert(Notification)
            .values(
                user_id=user.id, stock_id=s.id,
                direction="UP" if pc.change_rate > 0 else "DOWN",
                level=level, change_rate=round(pc.change_rate, 2), price=pc.price, trade_date=pc.trade_date,
            )
            .on_conflict_do_nothing(index_elements=["user_id", "stock_id", "trade_date", "direction", "level"])
        )
    db.commit()


@router.get("")
async def list_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _detect_price_alerts(db, current_user)

    rows = (
        db.query(Notification, Stock)
        .join(Stock, Stock.id == Notification.stock_id)
        .filter(Notification.user_id == current_user.id, Notification.deleted_at.is_(None))
        .order_by(Notification.created_at.desc())
        .limit(LIST_LIMIT)
        .all()
    )
    unread_count = (
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == current_user.id, Notification.read_at.is_(None), Notification.deleted_at.is_(None))
        .scalar()
    )

    return {
        "success": True,
        "data": {
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
        },
        "message": "요청 성공",
    }


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

from sqlalchemy import text
from sqlalchemy.orm import Session

# 이 시간보다 오래 갱신되지 않은 시세로는 주문을 체결하지 않는다 (백그라운드 동기화 주기는 30초)
MAX_PRICE_AGE_SECONDS = 180


def get_current_prices(db: Session, stock_ids: list[int], fresh_only: bool = False) -> dict[int, int]:
    """stock_price_cache(app.core.price_sync가 30초마다 갱신)에서 종목별 현재가를 읽는다.
    fresh_only=True면 MAX_PRICE_AGE_SECONDS 이내에 갱신된 시세만 돌려준다 (주문 체결용).
    동기 세션을 쓰는 주문/포트폴리오 라우터에서 쓰려고 비동기 모델 대신 SQL로 조회한다."""
    if not stock_ids:
        return {}

    query = "SELECT stock_id, current_price FROM stock_price_cache WHERE stock_id = ANY(:ids)"
    if fresh_only:
        query += " AND fetched_at > now() - make_interval(secs => :max_age)"
    rows = db.execute(text(query), {"ids": stock_ids, "max_age": MAX_PRICE_AGE_SECONDS}).all()
    return {stock_id: current_price for stock_id, current_price in rows}

from datetime import datetime, time, timedelta, timezone

KST = timezone(timedelta(hours=9))

# KRX 정규장. 장 시작 전·마감 후 시간외 거래와 동시호가는 다루지 않는다.
MARKET_OPEN = time(9, 0)
MARKET_CLOSE = time(15, 30)


def now_kst() -> datetime:
    return datetime.now(KST)


def is_market_open(now: datetime) -> bool:
    """평일 09:00~15:30(KST)인지. 공휴일은 여기서 알 수 없어, 실제 체결 전에 호가가 오늘 것인지 따로 확인한다
    (app.core.order_matching.is_orderbook_live)."""
    now = now.astimezone(KST)
    return now.weekday() < 5 and MARKET_OPEN <= now.time() < MARKET_CLOSE


def last_market_close(now: datetime) -> datetime:
    """now 이전(같거나 이른)의 가장 최근 평일 장 마감 시각."""
    now = now.astimezone(KST)
    close = datetime.combine(now.date(), MARKET_CLOSE, tzinfo=KST)
    while close > now or close.weekday() >= 5:
        close -= timedelta(days=1)
    return close

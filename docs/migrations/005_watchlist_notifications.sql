-- 관심 종목(하트)과 급등락 알림. 이미 만들어진 DB에 한 번 실행한다 (여러 번 실행해도 안전). 새로 만드는 DB는 schema.sql만 실행하면 된다.
-- 알림은 헤더가 알림 목록을 불러올 때 관심 종목의 전일 종가 대비 등락률을 계산해 ±5% 단계(5, 10, 15...)를 넘었으면 만든다.

-- 회원 설정의 "급등락 알림" 전체 스위치. 끄면 새 알림을 만들지 않는다
ALTER TABLE users ADD COLUMN IF NOT EXISTS price_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS watchlist (
    id             BIGSERIAL    PRIMARY KEY,
    user_id        BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_id       BIGINT       NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    alert_enabled  BOOLEAN      NOT NULL DEFAULT FALSE,   -- 이 종목의 급등락 알림을 받을지 (하트를 누를 때 묻는다)
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (user_id, stock_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id           BIGSERIAL     PRIMARY KEY,
    user_id      BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_id     BIGINT        NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    direction    VARCHAR(4)    NOT NULL CHECK (direction IN ('UP', 'DOWN')),
    level        INT           NOT NULL,                 -- 넘은 단계(5, 10, 15...). 같은 날 같은 단계는 한 번만 알린다
    change_rate  NUMERIC(6,2)  NOT NULL,                 -- 알림을 만든 순간의 전일 대비 등락률(%)
    price        BIGINT        NOT NULL,                 -- 알림을 만든 순간의 현재가
    trade_date   DATE          NOT NULL,                 -- 등락률을 계산한 거래일
    read_at      TIMESTAMPTZ   NULL,
    deleted_at   TIMESTAMPTZ   NULL,                     -- 사용자가 지운 알림. 행을 남겨야 같은 날 같은 단계 알림이 다시 생기지 않는다
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (user_id, stock_id, trade_date, direction, level)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at DESC);

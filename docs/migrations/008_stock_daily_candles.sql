-- 종목 일봉 저장 테이블. 차트의 일·주·월·년봉은 이 일봉을 읽어 만든다. 이미 만들어진 DB에 한 번 실행한다 (여러 번 실행해도 안전).
-- 팀원 SQL 덤프로 테이블을 먼저 만든 DB에는 (stock_id, trade_date) 유일 제약과 created_at/updated_at이 없어서 채워 준다.

CREATE TABLE IF NOT EXISTS stock_daily_candles (
    id              BIGSERIAL       PRIMARY KEY,
    stock_id        BIGINT          NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    trade_date      DATE            NOT NULL,
    open_price      BIGINT          NOT NULL CHECK (open_price >= 0),
    high_price      BIGINT          NOT NULL CHECK (high_price >= 0),
    low_price       BIGINT          NOT NULL CHECK (low_price >= 0),
    close_price     BIGINT          NOT NULL CHECK (close_price >= 0),
    volume          BIGINT          NOT NULL CHECK (volume >= 0),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (stock_id, trade_date)
);

ALTER TABLE stock_daily_candles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE stock_daily_candles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 새 일봉을 넣을 때 같은 날짜는 덮어쓰므로 (stock_id, trade_date)가 유일해야 한다. 중복이 있으면 가장 최근 행만 남긴다
DELETE FROM stock_daily_candles a USING stock_daily_candles b
WHERE a.stock_id = b.stock_id AND a.trade_date = b.trade_date AND a.id < b.id;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'stock_daily_candles_stock_id_trade_date_key'
    ) THEN
        ALTER TABLE stock_daily_candles
            ADD CONSTRAINT stock_daily_candles_stock_id_trade_date_key UNIQUE (stock_id, trade_date);
    END IF;
END $$;

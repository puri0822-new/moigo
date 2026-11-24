-- 매수 예약금(escrow)과 주문 체결 알림(kind=ORDER). 여러 번 실행해도 안전.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS escrow_amount BIGINT NOT NULL DEFAULT 0;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'PRICE';

-- direction에 BUY/SELL 허용 (기존 UP/DOWN + 주문 체결)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_direction_check;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notifications_direction_check'
    ) THEN
        ALTER TABLE notifications
            ADD CONSTRAINT notifications_direction_check
            CHECK (direction IN ('UP', 'DOWN', 'BUY', 'SELL'));
    END IF;
END $$;

-- 급등락 알림만 유니크. 주문 체결 알림은 여러 번 가능
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_stock_id_trade_date_direction_level_key;
DROP INDEX IF EXISTS notifications_price_unique;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_price_unique
    ON notifications (user_id, stock_id, trade_date, direction, level)
    WHERE kind = 'PRICE';

-- 지정가 미체결·부분 체결. 이미 만들어진 DB에 한 번 실행한다 (여러 번 실행해도 안전).
-- 기존 주문은 전부 체결된 시장가로 본다.

-- 평균 체결가 반올림 때문에 total_amount = price * quantity 가 안 맞을 수 있어 제약을 푼다
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_total_amount;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_type VARCHAR(10) NOT NULL DEFAULT 'MARKET';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'FILLED';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS limit_price BIGINT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS filled_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS filled_amount BIGINT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS filled_at TIMESTAMPTZ NULL;

-- 이미 있던 행: 전량 체결로 맞춤
UPDATE orders
SET filled_quantity = quantity,
    filled_amount = total_amount,
    filled_at = COALESCE(filled_at, ordered_at)
WHERE status = 'FILLED' AND filled_quantity = 0;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_price_type') THEN
        ALTER TABLE orders ADD CONSTRAINT chk_price_type CHECK (price_type IN ('MARKET', 'LIMIT'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_order_status') THEN
        ALTER TABLE orders ADD CONSTRAINT chk_order_status CHECK (status IN ('PENDING', 'FILLED', 'CANCELLED', 'EXPIRED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_limit_price') THEN
        ALTER TABLE orders ADD CONSTRAINT chk_limit_price CHECK (limit_price IS NULL OR limit_price > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_filled_quantity') THEN
        ALTER TABLE orders ADD CONSTRAINT chk_filled_quantity CHECK (filled_quantity >= 0 AND filled_quantity <= quantity);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_filled_amount') THEN
        ALTER TABLE orders ADD CONSTRAINT chk_filled_amount CHECK (filled_amount >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders(stock_id) WHERE status = 'PENDING';

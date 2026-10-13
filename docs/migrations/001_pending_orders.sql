-- 미체결(대기) 주문 지원: 주문 상태, 주문 유형, 지정가, 체결 시각을 추가한다.
-- 이미 만들어진 DB에 한 번 실행한다 (여러 번 실행해도 안전). 새로 만드는 DB는 schema.sql만 실행하면 된다.

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS status      VARCHAR(10) NOT NULL DEFAULT 'FILLED',
    ADD COLUMN IF NOT EXISTS price_type  VARCHAR(10) NOT NULL DEFAULT 'MARKET',
    ADD COLUMN IF NOT EXISTS limit_price BIGINT      NULL,
    ADD COLUMN IF NOT EXISTS filled_at   TIMESTAMPTZ NULL;

-- 지금까지의 주문은 모두 즉시 체결된 주문이다
UPDATE orders SET filled_at = ordered_at WHERE status = 'FILLED' AND filled_at IS NULL;

-- 여러 호가 단계에 걸쳐 체결되면 price는 평균 체결가(반올림)라 price * quantity가 실제 금액과 다를 수 있다
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_total_amount;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_order_status;
ALTER TABLE orders ADD CONSTRAINT chk_order_status CHECK (status IN ('PENDING', 'FILLED', 'CANCELLED', 'EXPIRED'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_price_type;
ALTER TABLE orders ADD CONSTRAINT chk_price_type CHECK (price_type IN ('MARKET', 'LIMIT'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_limit_price;
ALTER TABLE orders ADD CONSTRAINT chk_limit_price CHECK (limit_price IS NULL OR limit_price > 0);

-- 미체결 주문만 주기적으로 훑으므로 그 행만 담는 작은 인덱스
CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders(stock_id) WHERE status = 'PENDING';

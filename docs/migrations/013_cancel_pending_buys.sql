-- 예약 매수 폐지: 남은 미체결 매수의 예약금을 환불하고 취소한다.

UPDATE accounts a
SET balance = a.balance + sub.escrow
FROM (
    SELECT account_id, SUM(escrow_amount) AS escrow
    FROM orders
    WHERE status = 'PENDING' AND order_type = 'BUY' AND escrow_amount > 0
    GROUP BY account_id
) sub
WHERE a.id = sub.account_id;

UPDATE orders
SET status = 'CANCELLED',
    escrow_amount = 0
WHERE status = 'PENDING' AND order_type = 'BUY';

-- 예약 매도 폐지: 남은 미체결 매도를 취소한다. (매수는 013에서 처리)

UPDATE orders
SET status = 'CANCELLED',
    escrow_amount = 0
WHERE status = 'PENDING';

import { useTheme } from '../../context/ThemeContext';
import type { ApiOrder, OrderStatus } from '../../lib/api';
import { FS, FW, RADIUS } from '../../lib/tokens';

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = { PENDING: '미체결', FILLED: '체결', CANCELLED: '취소', EXPIRED: '만료' };

function formatOrderTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const hms = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return d.toDateString() === new Date().toDateString() ? hms : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

interface StockOrderListProps {
  orders: ApiOrder[];
  onCancel: (orderId: number) => void;
}

// 주문 내역 (서버에 저장된 이 종목의 주문. 미체결 주문은 취소할 수 있다)
export default function StockOrderList({ orders, onCancel }: StockOrderListProps) {
  const { theme } = useTheme();
  return (
    <div style={{ flex: 1, minWidth: 0, background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: RADIUS.lg, overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: FS.body, fontWeight: FW.semibold }}>주문 내역</span>
      </div>
      {orders.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: FS.caption, color: theme.textMuted }}>
          주문 내역이 없습니다
        </div>
      ) : (
        // 좁은 화면에서는 칸이 뭉개지지 않게 가로 스크롤로 보여준다
        <div style={{ minWidth: 400 }}>
          {/* 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 56px 1fr 56px 44px', gap: 8, padding: '8px 16px', borderBottom: `1px solid ${theme.border}`, fontSize: FS.caption, fontWeight: FW.medium, color: theme.textMuted }}>
            <span>구분</span><span>가격</span><span style={{ textAlign: 'center' }}>수량</span><span style={{ textAlign: 'right' }}>금액</span><span style={{ textAlign: 'right' }}>시간</span><span style={{ textAlign: 'right' }}>상태</span>
          </div>
          {orders.map((o, i) => {
            // 취소·만료된 주문은 흐리게 보여준다
            const inactive = o.status === 'CANCELLED' || o.status === 'EXPIRED';
            return (
              <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 56px 1fr 56px 44px', gap: 8, padding: '8px 16px', borderBottom: i < orders.length - 1 ? `1px solid ${theme.border}` : 'none', fontSize: FS.caption, alignItems: 'center', opacity: inactive ? 0.5 : 1 }}>
                <span style={{ fontWeight: FW.semibold, color: o.order_type === 'BUY' ? theme.up : theme.down }}>
                  {o.order_type === 'BUY' ? '매수' : '매도'}
                </span>
                <span style={{ color: theme.text }}>{o.price.toLocaleString()}원</span>
                <span style={{ textAlign: 'center', color: theme.text }}>{o.quantity.toLocaleString()}주</span>
                <span style={{ textAlign: 'right', fontWeight: FW.medium }}>{o.total_amount.toLocaleString()}원</span>
                <span style={{ textAlign: 'right', color: theme.textMuted, fontSize: FS.caption }}>{formatOrderTime(o.filled_at ?? o.ordered_at)}</span>
                {o.status === 'PENDING' ? (
                  <button
                    type="button"
                    onClick={() => onCancel(o.id)}
                    aria-label="미체결 주문 취소"
                    style={{
                      justifySelf: 'end', padding: '4px 12px', borderRadius: RADIUS.md,
                      border: `1px solid ${theme.inputBorder}`, fontSize: FS.caption, fontWeight: FW.medium, color: theme.text,
                    }}
                  >
                    취소
                  </button>
                ) : (
                  <span style={{ textAlign: 'right', fontSize: FS.caption, color: theme.textMuted }}>{ORDER_STATUS_LABEL[o.status]}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useTheme } from '../../context/ThemeContext';
import StockLogo from '../StockLogo';
import OrderbookLevels from './OrderbookLevels';
import type { ApiOrderbook, ApiStockDetail } from '../../lib/api';

interface OrderbookModalProps {
  stock: ApiStockDetail;
  currentPrice: number;
  orderbook: ApiOrderbook | null;
  status: 'loading' | 'ready' | 'error';
  onPick: (price: number) => void;
  onClose: () => void;
}

// 호가 크게 보기 (10단계)
export default function OrderbookModal({ stock, currentPrice, orderbook, status, onPick, onClose }: OrderbookModalProps) {
  const { theme } = useTheme();
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 420, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 48px)',
        background: theme.panel, border: `1px solid ${theme.border}`,
        borderRadius: 16, padding: 20,
        boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StockLogo name={stock.name} code={stock.code} size={28} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{stock.name} 호가</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>현재가 {currentPrice.toLocaleString()}원 · 호가를 누르면 지정가로 입력</div>
          </div>
          <div
            onClick={onClose}
            style={{
              marginLeft: 'auto', width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: theme.textMuted, fontSize: 13,
            }}
          >✕</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: theme.textMuted, padding: '0 10px 6px', borderBottom: `1px solid ${theme.border}` }}>
          <span>호가</span><span>잔량</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          <OrderbookLevels orderbook={orderbook} status={status} levelCount={10} large onPick={onPick} />
        </div>
      </div>
    </div>
  );
}

import { useTheme } from '../../context/ThemeContext';
import StockLogo from '../StockLogo';
import OrderbookLevels from './OrderbookLevels';
import type { ApiOrderbook, ApiStockDetail } from '../../lib/api';
import { FS, FW, RADIUS } from '../../lib/tokens';
import Pressable from '../Pressable';

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
        borderRadius: RADIUS.xl, padding: 20,
        boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StockLogo name={stock.name} code={stock.code} size={28} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: FS.title, fontWeight: FW.bold }}>{stock.name} 호가</div>
            <div style={{ fontSize: FS.caption, color: theme.textMuted }}>현재가 {currentPrice.toLocaleString()}원 · 호가를 누르면 지정가로 입력</div>
          </div>
          <Pressable
            onClick={onClose}
            aria-label="닫기"
            style={{
              marginLeft: 'auto', width: 28, height: 28, borderRadius: RADIUS.md, flexShrink: 0,
              border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: theme.textMuted, fontSize: FS.body,
            }}
          >✕</Pressable>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS.caption, fontWeight: FW.medium, color: theme.textMuted, padding: '0 12px 8px', borderBottom: `1px solid ${theme.border}` }}>
          <span>호가</span><span>잔량</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          <OrderbookLevels orderbook={orderbook} status={status} levelCount={10} large onPick={onPick} />
        </div>
      </div>
    </div>
  );
}

import { useTheme } from '../../context/ThemeContext';
import type { ApiOrderbook } from '../../lib/api';

interface OrderbookLevelsProps {
  orderbook: ApiOrderbook | null;
  status: 'loading' | 'ready' | 'error';
  levelCount: number;
  large: boolean;
  // 호가를 누르면 그 가격으로 지정가 주문을 넣을 수 있게 채워준다
  onPick: (price: number) => void;
}

// 호가 목록. 패널에는 5단계, 크게 보기에서는 10단계를 큰 글씨로 보여준다
export default function OrderbookLevels({ orderbook, status, levelCount, large, onPick }: OrderbookLevelsProps) {
  const { theme } = useTheme();

  if (!orderbook) {
    return (
      <div style={{ fontSize: 12, color: theme.textMuted, padding: '20px 0', textAlign: 'center' }}>
        {status === 'error' ? '호가를 불러오지 못했습니다' : '호가를 불러오는 중...'}
      </div>
    );
  }
  // 위에서부터 높은 가격순: 매도호가(현재가에서 먼 것부터) → 매수호가(현재가에 가까운 것부터)
  const asks = orderbook.asks.slice(0, levelCount).reverse();
  const bids = orderbook.bids.slice(0, levelCount);
  if (asks.length === 0 && bids.length === 0) {
    return <div style={{ fontSize: 12, color: theme.textMuted, padding: '20px 0', textAlign: 'center' }}>표시할 호가가 없습니다</div>;
  }
  const maxVolume = Math.max(1, ...asks.map(l => l.volume), ...bids.map(l => l.volume));
  const row = (l: { price: number; volume: number }, side: 'ask' | 'bid') => {
    const color = side === 'ask' ? theme.down : theme.up;
    return (
      <div
        key={`${side}-${l.price}`}
        onClick={() => onPick(l.price)}
        style={{
          position: 'relative', display: 'flex', justifyContent: 'space-between',
          fontSize: large ? 14 : 12, padding: large ? '7px 10px' : '3px 6px',
          borderRadius: 4, cursor: 'pointer', overflow: 'hidden',
        }}
      >
        {/* 잔량 막대 */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0, right: 0,
          width: `${(l.volume / maxVolume) * 100}%`, background: color, opacity: 0.12,
        }} />
        <span style={{ position: 'relative', fontWeight: 600, color }}>{l.price.toLocaleString()}원</span>
        <span style={{ position: 'relative', color: theme.textMuted }}>{l.volume.toLocaleString()}</span>
      </div>
    );
  };
  return <>
    {asks.map(l => row(l, 'ask'))}
    <div style={{ height: 1, background: theme.border, margin: '2px 0' }} />
    {bids.map(l => row(l, 'bid'))}
  </>;
}

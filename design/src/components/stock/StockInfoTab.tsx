import { useTheme } from '../../context/ThemeContext';
import type { ApiStockDetail, ApiStockInfo } from '../../lib/api';

function formatMarketCap(won: number) {
  const eok = Math.round(won / 100_000_000);
  if (eok >= 10_000) {
    const rest = eok % 10_000;
    return `${Math.floor(eok / 10_000).toLocaleString()}조${rest ? ` ${rest.toLocaleString()}억` : ''}원`;
  }
  return `${eok.toLocaleString()}억원`;
}

interface StockInfoTabProps {
  stock: ApiStockDetail;
  info: ApiStockInfo | null;
  status: 'loading' | 'ready' | 'error';
}

export default function StockInfoTab({ stock, info, status }: StockInfoTabProps) {
  const { theme } = useTheme();
  return (
    <div style={{
      background: theme.panel, border: `1px solid ${theme.border}`,
      borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>종목정보</div>
      {!info ? (
        <div style={{ fontSize: 12, color: theme.textMuted, padding: '20px 0', textAlign: 'center' }}>
          {status === 'error' ? '종목정보를 불러오지 못했습니다' : '종목정보를 불러오는 중...'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 24 }}>
          {([
            // 시가총액은 상장주식수 × 현재가라 현재가가 갱신될 때마다 같이 바뀐다
            ['시가총액', info.shares_outstanding != null && stock.current_price != null ? formatMarketCap(info.shares_outstanding * stock.current_price) : '-'],
            ['상장주식수', info.shares_outstanding != null ? `${info.shares_outstanding.toLocaleString()}주` : '-'],
            ['시장', info.market ?? stock.market],
            ['업종', stock.sector ?? '-'],
            ['상장일', info.list_date ?? '-'],
            ['주식 종류', info.is_common_share == null ? '-' : info.is_common_share ? '보통주' : '우선주 등'],
            ['영문명', info.english_name ?? '-'],
            ['ISIN', info.isin_code ?? '-'],
            ['거래 상태', info.trading_suspended ? '거래정지' : info.status === 'ACTIVE' ? '정상' : info.status ?? '-'],
            ['대체거래소(NXT)', info.nxt_supported == null ? '-' : info.nxt_supported ? '거래 가능' : '거래 불가'],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', gap: 12,
              padding: '10px 0', borderBottom: `1px solid ${theme.border}`, fontSize: 13,
            }}>
              <span style={{ color: theme.textMuted, flexShrink: 0 }}>{label}</span>
              <span style={{ fontWeight: 600, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

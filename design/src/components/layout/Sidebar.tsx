import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { stocks, holdings } from '../../data/mockData';
import StockLogo from '../StockLogo';

export default function Sidebar() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  return (
    <div style={{
      width: 250, flexShrink: 0,
      borderRight: `1px solid ${theme.border}`,
      background: theme.panel,
      padding: '20px 16px',
      display: 'flex', flexDirection: 'column', gap: 14,
      overflowY: 'auto',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
        color: theme.textMuted, textTransform: 'uppercase',
      }}>
        내 모의매매
      </div>

      <div style={{
        background: theme.panel2, border: `1px solid ${theme.border}`,
        borderRadius: 10, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{ fontSize: 11, color: theme.textMuted }}>총 평가자산</div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>12,458,300원</div>
        <div style={{ fontSize: 12, color: theme.up, fontWeight: 600 }}>▲ 오늘 +2.3%</div>
        <div style={{ height: 1, background: theme.border, margin: '4px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: theme.textMuted }}>
          <span>가상현금</span>
          <span style={{ color: theme.text, fontWeight: 600 }}>3,120,000원</span>
        </div>
      </div>

      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
        color: theme.textMuted, textTransform: 'uppercase', marginTop: 6,
      }}>
        보유 종목
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {holdings.map(h => {
          const stock = stocks.find(s => s.name === h.name) || stocks[0];
          const priceNum = parseInt(stock.price.replace(/[^0-9]/g, ''), 10);
          const amount = Math.round(priceNum * h.changePct / 100);
          const changeColor = h.changePct >= 0 ? theme.up : theme.down;
          const changeLabel = (h.changePct >= 0 ? '▲' : '▼') + Math.abs(h.changePct).toFixed(1) + '%';
          const changeAmount = (amount >= 0 ? '+' : '-') + Math.abs(amount).toLocaleString() + '원';
          return (
            <div
              key={h.name}
              onClick={() => navigate(`/stock/${stock.code}`)}
              style={{
                background: theme.panel2, border: `1px solid ${theme.border}`,
                borderRadius: 9, padding: '10px 12px',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StockLogo name={h.name} size={28} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                  <span>{h.name}</span>
                  <span style={{ color: theme.textMuted, fontWeight: 500 }}>{h.qty}</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: changeColor }}>{changeLabel} ({changeAmount})</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{stock.price}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { stocks, aiRecs, marketIndices, holdings } from '../data/mockData';
import StockLogo from '../components/StockLogo';

export default function DashboardPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const mockPortfolio = {
    totalAsset: 12_480_000,
    balance: 3_200_000,
    totalProfit: 480_000,
    profitRate: 4.0,
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>

      {/* 왼쪽: AI 추천 & 등락 이유 */}
      <div style={{
        width: 300, flexShrink: 0,
        borderRight: `1px solid ${theme.border}`,
        background: theme.panel,
        padding: 20,
        display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.ai }}>
          AI 추천 &amp; 등락 이유
        </div>

        {aiRecs.map((a, i) => {
          const stock = stocks.find(s => s.name === a.stockName) || stocks[0];
          const changeColor = stock.changePct >= 0 ? theme.up : theme.down;
          const changeLabel = (stock.changePct >= 0 ? '▲' : '▼') + Math.abs(stock.changePct).toFixed(1) + '%';
          return (
            <div
              key={i}
              onClick={() => navigate(`/stock/${stock.code}`)}
              style={{
                background: theme.panel2, border: `1px solid ${theme.border}`,
                borderRadius: 10, padding: 12,
                display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>{a.bot}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{a.stockName}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: changeColor }}>{changeLabel}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>{a.reason}</div>
            </div>
          );
        })}
      </div>

      {/* 가운데: 실시간 거래량 랭킹 */}
      <div style={{
        flex: 1, minWidth: 0, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {marketIndices.map(idx => {
            const changeColor = idx.changePct >= 0 ? theme.up : theme.down;
            const changeLabel = (idx.changePct >= 0 ? '▲' : '▼') + Math.abs(idx.changePct).toFixed(2) + '%';
            return (
              <div key={idx.name} style={{
                flex: 1, background: theme.panel, border: `1px solid ${theme.border}`,
                borderRadius: 12, padding: '14px 18px',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>{idx.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 800 }}>{idx.value}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: changeColor }}>
                    {idx.changePoint} ({changeLabel})
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>실시간 거래량 랭킹</div>
          <div style={{ fontSize: 12, color: theme.textMuted }}>거래량 기준 · 실시간</div>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 1,
          background: theme.border, border: `1px solid ${theme.border}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          {stocks.map(s => {
            const changeColor = s.changePct >= 0 ? theme.up : theme.down;
            const changeLabel = (s.changePct >= 0 ? '▲' : '▼') + Math.abs(s.changePct).toFixed(1) + '%';
            return (
              <div
                key={s.code}
                onClick={() => navigate(`/stock/${s.code}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 18px', background: theme.panel, cursor: 'pointer',
                }}
              >
                <div style={{ width: 22, flexShrink: 0, fontSize: 13, fontWeight: 700, color: theme.textMuted }}>
                  {s.rank}
                </div>
                <StockLogo name={s.name} size={36} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{s.price}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 11 }}>
                    <span style={{ color: theme.textMuted }}>거래량 {s.volume}</span>
                    <span style={{ fontWeight: 700, color: changeColor, flexShrink: 0 }}>{changeLabel}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 오른쪽: 내 모의매매 */}
      <div style={{
        width: 300, flexShrink: 0,
        borderLeft: `1px solid ${theme.border}`,
        background: theme.panel,
        padding: 20,
        display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>내 모의매매</div>

        {/* 총 평가자산 */}
        <div style={{
          background: theme.panel2, border: `1px solid ${theme.border}`,
          borderRadius: 10, padding: 14,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>총 평가자산</div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>
            {mockPortfolio.totalAsset.toLocaleString()}원
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: theme.textMuted }}>수익</span>
            <span style={{ fontWeight: 700, color: theme.up }}>
              +{mockPortfolio.totalProfit.toLocaleString()}원 ({mockPortfolio.profitRate.toFixed(2)}%)
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: theme.textMuted }}>가상현금</span>
            <span style={{ fontWeight: 600 }}>{mockPortfolio.balance.toLocaleString()}원</span>
          </div>
        </div>

        {/* 보유 종목 */}
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>보유 종목</div>
        {holdings.map(h => {
          const changeColor = h.changePct >= 0 ? theme.up : theme.down;
          const changeLabel = (h.changePct >= 0 ? '▲' : '▼') + Math.abs(h.changePct).toFixed(1) + '%';
          const stock = stocks.find(s => s.name === h.name);
          return (
            <div
              key={h.name}
              onClick={() => stock && navigate(`/stock/${stock.code}`)}
              style={{
                background: theme.panel2, border: `1px solid ${theme.border}`,
                borderRadius: 10, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              }}
            >
              <StockLogo name={h.name} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.name}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: changeColor, flexShrink: 0, marginLeft: 6 }}>
                    {changeLabel}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{h.qty}</div>
              </div>
            </div>
          );
        })}

        <div
          onClick={() => navigate('/portfolio')}
          style={{
            textAlign: 'center', padding: '9px 0', borderRadius: 8,
            border: `1px solid ${theme.border}`, fontSize: 12, fontWeight: 600,
            color: theme.textMuted, cursor: 'pointer', marginTop: 4,
          }}
        >
          전체 포트폴리오 보기
        </div>
      </div>
    </div>
  );
}

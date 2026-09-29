import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { stocks, aiRecs, marketIndices, holdings } from '../data/mockData';
import StockLogo from '../components/StockLogo';

export default function DashboardPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [activeRec, setActiveRec] = useState(0);
  const [showRec, setShowRec] = useState(true);

  const mockPortfolio = {
    totalAsset: 12_480_000,
    balance: 3_200_000,
    totalProfit: 480_000,
    profitRate: 4.0,
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveRec(prev => (prev + 1) % aiRecs.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const rec = aiRecs[activeRec];
  const recStock = stocks.find(s => s.name === rec.stockName) || stocks[0];
  const recChangeLabel = (recStock.changePct >= 0 ? '▲' : '▼') + Math.abs(recStock.changePct).toFixed(1) + '%';

  return (
    <div style={{ display: 'flex', height: '100%' }}>

      {/* 가운데: 메인 콘텐츠 */}
      <div style={{
        flex: 1, minWidth: 0, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto',
      }}>
        {/* 지수 */}
        <div style={{ display: 'flex', gap: 12 }}>
          {marketIndices.map(idx => {
            const changeColor = idx.changePct >= 0 ? theme.up : theme.down;
            const changeLabel = (idx.changePct >= 0 ? '▲' : '▼') + Math.abs(idx.changePct).toFixed(2) + '%';
            const W = 80, H = 36, PAD = 3;
            const min = Math.min(...idx.spark);
            const max = Math.max(...idx.spark);
            const range = max - min || 1;
            const toY = (v: number) => PAD + (1 - (v - min) / range) * (H - PAD * 2);
            const pts = idx.spark.map((v, i) => {
              const x = (i / (idx.spark.length - 1)) * W;
              return `${x},${toY(v)}`;
            }).join(' ');
            const baseY = toY(idx.spark[0]);
            return (
              <div key={idx.name} style={{
                flex: 1, background: theme.panel, border: `1px solid ${theme.border}`,
                borderRadius: 12, padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>{idx.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 800 }}>{idx.value}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: changeColor }}>
                    {idx.changePoint} ({changeLabel})
                  </span>
                </div>
                <svg width={W} height={H} style={{ flexShrink: 0 }}>
                  {/* 기준선 (시가) */}
                  <line
                    x1={0} y1={baseY} x2={W} y2={baseY}
                    stroke={theme.border} strokeWidth={1} strokeDasharray="3 3"
                  />
                  {/* 라인 */}
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={changeColor}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            );
          })}
        </div>

        {/* 거래량 랭킹 */}
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
                <StockLogo name={s.name} code={s.code} size={36} />
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

      {/* 오른쪽: AI 추천 + 내 모의매매 */}
      <div style={{
        width: 300, flexShrink: 0,
        borderLeft: `1px solid ${theme.border}`,
        background: theme.panel,
        padding: 20,
        display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto',
      }}>

        {/* AI 추천 자동 전환 카드 */}
        {showRec && <div
          onClick={() => navigate(`/stock/${recStock.code}`)}
          style={{
            background: theme.ai, borderRadius: 14, padding: '20px 18px',
            display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer',
            position: 'relative', overflow: 'hidden', minHeight: 180,
          }}
        >
          {/* 배경 장식 */}
          <div style={{
            position: 'absolute', right: -20, top: -20,
            width: 100, height: 100, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          }} />
          <div style={{
            position: 'absolute', right: 20, bottom: -30,
            width: 70, height: 70, borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          }} />

          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              <img
                src={rec.icon}
                alt={rec.bot}
                width={20}
                height={20}
                style={{ objectFit: 'contain' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{rec.bot}</span>
            <div
              onClick={e => { e.stopPropagation(); setShowRec(false); }}
              style={{
                marginLeft: 'auto', width: 22, height: 22, borderRadius: 6,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.7)',
                flexShrink: 0,
              }}
            >✕</div>
          </div>

          {/* 종목 정보 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{rec.stockName}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: recStock.changePct >= 0 ? '#86efac' : '#fca5a5' }}>
                {recChangeLabel}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, wordBreak: 'keep-all' }}>
              {rec.reason}
            </div>
          </div>
        </div>}

        <div style={{
          fontSize: 13, fontWeight: 700, color: theme.ai,
          background: theme.aiSoft, borderRadius: 8, padding: '7px 12px',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          border: `1px solid ${theme.ai}`,
        }}>
          ✦ 내 모의매매
        </div>

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
              <StockLogo name={h.name} code={stock?.code} size={30} />
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

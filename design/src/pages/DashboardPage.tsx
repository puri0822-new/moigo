import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { stocks, aiRecs, marketIndices } from '../data/mockData';
import StockLogo from '../components/StockLogo';

export default function DashboardPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'거래량' | '급상승' | '급하락'>('거래량');
  const [stockRecIndices, setStockRecIndices] = useState<Record<string, number>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      setStockRecIndices(prev => {
        const next = { ...prev };
        stocks.forEach(s => {
          const recs = aiRecs.filter(r => r.stockName === s.name);
          if (recs.length > 1) {
            next[s.name] = ((prev[s.name] ?? 0) + 1) % recs.length;
          }
        });
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100%' }}>

      {/* 가운데: 메인 콘텐츠 */}
      <div style={{
        flex: 1, minWidth: 0, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 14,
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

        {/* 거래량 차트 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>실시간 거래량 차트</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['거래량', '급상승', '급하락'] as const).map(tab => (
              <div
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                  cursor: 'pointer',
                  background: activeTab === tab ? theme.ai : theme.panel2,
                  color: activeTab === tab ? '#fff' : theme.textMuted,
                  border: `1px solid ${activeTab === tab ? theme.ai : theme.border}`,
                }}
              >{tab}</div>
            ))}
          </div>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 1,
          background: theme.border, border: `1px solid ${theme.border}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          {[...stocks]
            .sort((a, b) =>
              activeTab === '급상승' ? b.changePct - a.changePct :
              activeTab === '급하락' ? a.changePct - b.changePct :
              a.rank - b.rank
            )
            .map((s, i) => {
            const changeColor = s.changePct >= 0 ? theme.up : theme.down;
            const changeLabel = (s.changePct >= 0 ? '▲' : '▼') + Math.abs(s.changePct).toFixed(1) + '%';
            const stockRecs = aiRecs.filter(r => r.stockName === s.name);
            const aiRec = stockRecs[(stockRecIndices[s.name] ?? 0) % stockRecs.length];
            const signalColor = aiRec?.signal === '매수' ? theme.up : aiRec?.signal === '매도' ? theme.down : theme.textMuted;
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
                  {i + 1}
                </div>
                <StockLogo name={s.name} code={s.code} size={36} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{s.name}</span>
                      {aiRec && (
                        <div
                          key={`${s.name}-${aiRec.bot}-${aiRec.signal}`}
                          className="ai-rec-slide"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden' }}
                        >
                          <img src={aiRec.icon} alt={aiRec.bot} width={12} height={12} style={{ borderRadius: 3, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 600, flexShrink: 0 }}>{aiRec.bot}</span>
                          <span style={{ fontSize: 11, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {aiRec.reason}</span>
                          <span style={{
                            flexShrink: 0,
                            fontSize: 10, fontWeight: 700, color: signalColor,
                            border: `1px solid ${signalColor}`, borderRadius: 4,
                            padding: '1px 5px',
                          }}>{aiRec.signal}</span>
                        </div>
                      )}
                    </div>
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


    </div>
  );
}

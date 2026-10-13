import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { aiRecs } from '../data/mockData';
import { apiGet } from '../lib/api';
import type { ApiStock } from '../lib/api';
import StockLogo from '../components/StockLogo';

interface DisplayStock {
  name: string;
  code: string;
  price: string;
  volume: string;
  volumeRaw: number;
  changePct: number;
  rank: number;
}

export default function DashboardPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'거래량' | '급상승' | '급하락'>('거래량');
  const [stockRecIndices, setStockRecIndices] = useState<Record<string, number>>({});
  const [liveStocks, setLiveStocks] = useState<DisplayStock[]>([]);
  const [marketIndices, setMarketIndices] = useState<{ name: string; value: string; changePoint: string; changePct: number; spark: number[] }[]>([]);

  useEffect(() => {
    apiGet<{ name: string; value: string; changePoint: string; changePct: number; spark: number[] }[]>('/market/indices')
      .then(res => setMarketIndices(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiGet<ApiStock[]>('/stocks')
      .then(res => {
        setLiveStocks(res.data.map((s, i) => ({
          name: s.name,
          code: s.code,
          price: s.current_price != null ? `${s.current_price.toLocaleString()}원` : '-',
          volume: s.volume != null ? (s.volume >= 1_000_000 ? `${(s.volume / 1_000_000).toFixed(1)}M` : `${(s.volume / 1_000).toFixed(0)}K`) : '-',
          volumeRaw: s.volume ?? 0,
          changePct: s.change_rate != null ? s.change_rate * 100 : 0,
          rank: i + 1,
        })));
      })
      .catch(() => {});
  }, []);

  const stocks = liveStocks;

  useEffect(() => {
    if (stocks.length === 0) return;
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
  }, [stocks]);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100%' }}>

      {/* 가운데: 메인 콘텐츠 */}
      <div style={{
        flex: 1, minWidth: 0, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* 소개 배너 */}
        <div style={{
          background: `linear-gradient(135deg, #4F6EF7 0%, #7B5EA7 60%, #3B4FC8 100%)`,
          borderRadius: 16, padding: '28px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'relative', overflow: 'hidden', minHeight: 140,
        }}>
          {/* 배경 장식 */}
          <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ position: 'absolute', right: 80, bottom: -60, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', left: '45%', top: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

          {/* 텍스트 */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', marginBottom: 10 }}>
              ✦ AI-Powered Mock Trading
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.4, marginBottom: 14 }}>
              AI가 분석하고,<br />내가 결정하는 모의매매
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: '포트폴리오', path: '/portfolio' },
                { label: '랭킹 보기', path: '/ranking' },
              ].map(item => (
                <div
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  style={{
                    padding: '7px 16px', borderRadius: 20,
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    fontSize: 12, fontWeight: 600, color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* 우측 지수 플로팅 카드 (그래프 포함) */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            {marketIndices.map(idx => {
              const isUp = idx.changePct >= 0;
              const W = 80, H = 32, PAD = 3;
              const spark = idx.spark.length > 1 ? idx.spark : [0, 0];
              const min = Math.min(...spark);
              const max = Math.max(...spark);
              const range = max - min || 1;
              const toY = (v: number) => PAD + (1 - (v - min) / range) * (H - PAD * 2);
              const pts = spark.map((v, i) => {
                const x = (i / (spark.length - 1)) * W;
                return `${x},${toY(v)}`;
              }).join(' ');
              const baseY = toY(spark[0]);
              return (
                <div key={idx.name} style={{
                  background: 'rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 12, padding: '10px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  minWidth: 200,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginBottom: 3 }}>{idx.name}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{idx.value}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isUp ? '#fca5a5' : '#93c5fd', marginTop: 2 }}>
                      {isUp ? '▲' : '▼'} {Math.abs(idx.changePct).toFixed(2)}%
                    </div>
                  </div>
                  {spark.length > 1 && (
                    <svg width={W} height={H} style={{ flexShrink: 0 }}>
                      <line x1={0} y1={baseY} x2={W} y2={baseY} stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="3 3" />
                      <polyline points={pts} fill="none" stroke={isUp ? '#fca5a5' : '#93c5fd'} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
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
              b.volumeRaw - a.volumeRaw
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

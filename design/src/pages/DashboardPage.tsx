import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { aiRecs, marketIndices } from '../data/mockData';
import StockLogo from '../components/StockLogo';
import { fetchStockRankings, type ApiStockRanking } from '../lib/api';

// 백엔드가 시세 캐시를 30초마다 갱신하므로 같은 주기로 다시 받아온다
const RANKINGS_REFRESH_MS = 30_000;

function formatVolume(volume: number | null) {
  if (volume == null) return '-';
  if (volume >= 100_000_000) return `${(volume / 100_000_000).toFixed(1)}억`;
  if (volume >= 10_000) return `${(volume / 10_000).toFixed(1)}만`;
  return volume.toLocaleString();
}

export default function DashboardPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'거래량' | '급상승' | '급하락'>('거래량');
  const [stockRecIndices, setStockRecIndices] = useState<Record<string, number>>({});
  const [rankings, setRankings] = useState<ApiStockRanking[]>([]);
  const [rankingsStatus, setRankingsStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchStockRankings()
        .then(data => {
          if (cancelled) return;
          setRankings(data);
          setRankingsStatus('ready');
        })
        .catch(() => {
          // 이미 받아 둔 목록이 있으면 일시적인 실패로 화면을 비우지 않는다
          if (!cancelled) setRankingsStatus(prev => (prev === 'ready' ? prev : 'error'));
        });
    };
    load();
    const timer = setInterval(load, RANKINGS_REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setStockRecIndices(prev => {
        const next = { ...prev };
        new Set(aiRecs.map(r => r.stockName)).forEach(name => {
          const recs = aiRecs.filter(r => r.stockName === name);
          if (recs.length > 1) {
            next[name] = ((prev[name] ?? 0) + 1) % recs.length;
          }
        });
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const rows = rankings.map(s => ({
    name: s.name,
    code: s.code,
    price: s.current_price != null ? `${s.current_price.toLocaleString()}원` : '-',
    tradingVolume: s.trading_volume ?? -1,
    volume: formatVolume(s.trading_volume),
    changePct: s.change_rate != null ? s.change_rate * 100 : 0,
  }));

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
          {rankingsStatus !== 'ready' && (
            <div style={{ padding: '28px 18px', background: theme.panel, textAlign: 'center', fontSize: 13, color: theme.textMuted }}>
              {rankingsStatus === 'loading' ? '시세를 불러오는 중...' : '시세를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'}
            </div>
          )}
          {[...rows]
            .sort((a, b) =>
              activeTab === '급상승' ? b.changePct - a.changePct :
              activeTab === '급하락' ? a.changePct - b.changePct :
              b.tradingVolume - a.tradingVolume
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

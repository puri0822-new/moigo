import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import StockLogo from '../components/StockLogo';
import { fetchMarketIndices, fetchStockRankings, type ApiMarketIndex, type ApiStockRanking } from '../lib/api';

// 백엔드가 시세 캐시를 30초마다 갱신하므로 같은 주기로 다시 받아온다
const RANKINGS_REFRESH_MS = 30_000;

const REC_LABEL: Record<string, '매수' | '매도' | '중립'> = {
  BUY: '매수',
  HOLD: '중립',
  SELL: '매도',
};

const BOT_META = {
  Gemini: { icon: 'https://www.google.com/s2/favicons?domain=gemini.google.com&sz=64' },
  Claude: { icon: 'https://www.google.com/s2/favicons?domain=anthropic.com&sz=64' },
  CLOVA: { icon: 'https://www.google.com/s2/favicons?domain=naver.com&sz=64' },
} as const;

function formatVolume(volume: number | null) {
  if (volume == null) return '-';
  if (volume >= 100_000_000) return `${(volume / 100_000_000).toFixed(1)}억`;
  if (volume >= 10_000) return `${(volume / 10_000).toFixed(1)}만`;
  return volume.toLocaleString();
}

/** 랭킹 한 줄용 — 긴 AI 요약을 짧게 */
function shortAiLine(text: string, max = 28) {
  const one = text.replace(/\s+/g, ' ').trim();
  if (one.length <= max) return one;
  return `${one.slice(0, max).trimEnd()}…`;
}

export default function DashboardPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'거래량' | '급상승' | '급하락'>('거래량');
  const [stockRecIndices, setStockRecIndices] = useState<Record<string, number>>({});
  const [rankings, setRankings] = useState<ApiStockRanking[]>([]);
  const [rankingsStatus, setRankingsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [marketIndices, setMarketIndices] = useState<ApiMarketIndex[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      // 지수를 못 받아와도 이미 받아 둔 값은 그대로 둔다 (한 번도 못 받았으면 지수 카드만 빠진다)
      fetchMarketIndices()
        .then(data => { if (!cancelled) setMarketIndices(data); })
        .catch(() => {});
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
        rankings.forEach(s => {
          const n = s.ai?.insights.length ?? 0;
          if (n > 1) {
            next[s.code] = ((prev[s.code] ?? 0) + 1) % n;
          }
        });
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [rankings]);

  const rows = rankings.map(s => ({
    name: s.name,
    code: s.code,
    price: s.current_price != null ? `${s.current_price.toLocaleString()}원` : '-',
    tradingVolume: s.trading_volume ?? -1,
    volume: formatVolume(s.trading_volume),
    changePct: s.change_rate != null ? s.change_rate * 100 : 0,
    insights: s.ai?.insights ?? [],
  }));

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
                { label: 'AI 포트폴리오 보러가기', path: '/ai-analysis' },
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
              const changePct = idx.change_rate * 100;
              const isUp = changePct >= 0;
              const W = 80, H = 32, PAD = 3;
              // 기준선은 전일 종가. 추이가 기준선 위에 있으면 오늘 오른 것이다
              const min = Math.min(...idx.spark, idx.prev_close);
              const max = Math.max(...idx.spark, idx.prev_close);
              const range = max - min || 1;
              const toY = (v: number) => PAD + (1 - (v - min) / range) * (H - PAD * 2);
              const pts = idx.spark.map((v, i) => {
                const x = idx.spark.length > 1 ? (i / (idx.spark.length - 1)) * W : W;
                return `${x},${toY(v)}`;
              }).join(' ');
              const baseY = toY(idx.prev_close);
              return (
                <div key={idx.code} style={{
                  background: 'rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 12, padding: '10px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  minWidth: 200,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginBottom: 3 }}>{idx.name}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{idx.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isUp ? '#fca5a5' : '#93c5fd', marginTop: 2 }}>
                      {isUp ? '▲' : '▼'} {Math.abs(idx.change).toFixed(2)} ({Math.abs(changePct).toFixed(2)}%)
                    </div>
                  </div>
                  <svg width={W} height={H} style={{ flexShrink: 0 }}>
                    <line x1={0} y1={baseY} x2={W} y2={baseY} stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="3 3" />
                    <polyline points={pts} fill="none" stroke={isUp ? '#fca5a5' : '#93c5fd'} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
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
            const insights = s.insights;
            const aiRec = insights.length
              ? insights[(stockRecIndices[s.code] ?? 0) % insights.length]
              : null;
            const signal = aiRec ? (REC_LABEL[aiRec.recommendation] ?? '중립') : null;
            const signalColor = signal === '매수' ? theme.up : signal === '매도' ? theme.down : theme.textMuted;
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
                      {aiRec && signal && (
                        <div
                          key={`${s.code}-${aiRec.bot}-${aiRec.recommendation}`}
                          className="ai-rec-slide"
                          title={aiRec.summary}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: 220, overflow: 'hidden' }}
                        >
                          <img
                            src={BOT_META[aiRec.bot].icon}
                            alt={aiRec.bot}
                            width={12}
                            height={12}
                            style={{ borderRadius: 3, flexShrink: 0 }}
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                          <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 600, flexShrink: 0 }}>{aiRec.bot}</span>
                          <span style={{ fontSize: 11, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {shortAiLine(aiRec.summary)}</span>
                          <span style={{
                            flexShrink: 0,
                            fontSize: 10, fontWeight: 700, color: signalColor,
                            border: `1px solid ${signalColor}`, borderRadius: 4,
                            padding: '1px 5px',
                          }}>{signal}</span>
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

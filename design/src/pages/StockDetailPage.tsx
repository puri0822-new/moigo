import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { UTCTimestamp } from 'lightweight-charts';
import { useTheme } from '../context/ThemeContext';
import { stocks, orderbook, aiRecs, holdings, stockAiInsights } from '../data/mockData';
import StockLogo from '../components/StockLogo';
import CandleChart from '../components/CandleChart';
import {
  fetchStockByCode, fetchStockCandles, fetchStockNews,
  type ApiNewsItem, type ApiStockDetail,
} from '../lib/api';
import { timeAgo } from '../lib/time';

const periods = ['1일', '1주', '1개월', '1년'] as const;

const PERIOD_PARAMS: Record<(typeof periods)[number], { interval: '1m' | '1d'; count: number }> = {
  '1일': { interval: '1m', count: 200 },
  '1주': { interval: '1d', count: 5 },
  '1개월': { interval: '1d', count: 22 },
  '1년': { interval: '1d', count: 200 }, // 토스 API 최대 200봉 제한으로 실제로는 약 9~10개월치까지만 표시됨
};
const KST_OFFSET_SECONDS = 9 * 60 * 60;

type ChartCandle = { time: UTCTimestamp | string; open: number; high: number; low: number; close: number };

const mockPortfolio = {
  totalAsset: 12_480_000,
  balance: 3_200_000,
  totalProfit: 480_000,
  profitRate: 4.0,
};

export default function StockDetailPage() {
  const { theme } = useTheme();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qty, setQty] = useState(1);
  const [period, setPeriod] = useState<(typeof periods)[number]>('1일');
  const [liked, setLiked] = useState(false);
  const [alerted, setAlerted] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [rightTab, setRightTab] = useState<'insight' | 'portfolio'>('insight');

  // AI 추천 자동 전환
  const [activeRec, setActiveRec] = useState(0);
  const [showRec, setShowRec] = useState(true);
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveRec(prev => (prev + 1) % aiRecs.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // 종목 정보·차트·뉴스는 실제 API, AI 인사이트·호가·내 모의매매는 아직 목업
  const [stock, setStock] = useState<ApiStockDetail | null>(null);
  const [stockStatus, setStockStatus] = useState<'loading' | 'ready' | 'notFound' | 'error'>('loading');
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [candlesStatus, setCandlesStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [candlesReloadKey, setCandlesReloadKey] = useState(0);
  const [news, setNews] = useState<ApiNewsItem[]>([]);
  const [newsStatus, setNewsStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setStockStatus('loading');
    fetchStockByCode(code)
      .then(data => {
        if (cancelled) return;
        setStock(data);
        setStockStatus(data ? 'ready' : 'notFound');
      })
      .catch(() => { if (!cancelled) setStockStatus('error'); });
    return () => { cancelled = true; };
  }, [code]);

  useEffect(() => {
    if (!stock) return;
    let cancelled = false;
    setNewsStatus('loading');
    fetchStockNews(stock.id)
      .then(data => {
        if (cancelled) return;
        setNews(data);
        setNewsStatus('ready');
      })
      .catch(() => { if (!cancelled) setNewsStatus('error'); });
    return () => { cancelled = true; };
  }, [stock]);

  useEffect(() => {
    if (!stock) return;
    let cancelled = false;
    const { interval, count } = PERIOD_PARAMS[period];
    setCandlesStatus('loading');
    fetchStockCandles(stock.id, interval, count)
      .then(data => {
        if (cancelled) return;
        setCandles(data.map(c => ({
          time: interval === '1d'
            ? c.timestamp.slice(0, 10)
            // lightweight-charts는 시간을 UTC로 표시하므로, 한국 시간으로 보이도록 9시간을 더해 전달
            : (Math.floor(new Date(c.timestamp).getTime() / 1000 + KST_OFFSET_SECONDS) as UTCTimestamp),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })));
        setCandlesStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setCandles([]);
        setCandlesStatus('error');
      });
    return () => { cancelled = true; };
  }, [stock, period, candlesReloadKey]);

  // AI 등락 이유·유사 종목은 목업 데이터에 있는 종목만 표시된다
  const mockStock = stocks.find(s => s.code === code);
  const priceNum = stock?.current_price ?? 0;
  const total = priceNum * qty;

  const rec = aiRecs[activeRec];
  const recCode = stocks.find(s => s.name === rec.stockName)?.code ?? stocks[0].code;
  const recMockPct = stocks.find(s => s.name === rec.stockName)?.changePct ?? 0;
  const recChangeLabel = (recMockPct >= 0 ? '▲' : '▼') + Math.abs(recMockPct).toFixed(1) + '%';

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2600);
  };

  const handleOrder = () => {
    if (!stock) return;
    showToast(`${side === 'buy' ? '매수' : '매도'} 체결: ${stock.name} ${qty}주 · ${total.toLocaleString()}원`, true);
  };

  if (stockStatus !== 'ready' || !stock) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ color: stockStatus === 'loading' ? theme.textMuted : theme.down, fontSize: 14 }}>
          {stockStatus === 'loading' && '종목 정보를 불러오는 중...'}
          {stockStatus === 'notFound' && '종목 정보를 찾을 수 없습니다.'}
          {stockStatus === 'error' && '종목 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'}
        </div>
        {stockStatus !== 'loading' && (
          <button onClick={() => navigate('/')} style={{ alignSelf: 'flex-start', color: theme.ai, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
            ← 홈으로
          </button>
        )}
      </div>
    );
  }

  const changePct = stock.change_rate != null ? stock.change_rate * 100 : null;

  return (
    <div style={{ display: 'flex', minHeight: '100%', alignItems: 'flex-start' }}>
      {/* 메인 콘텐츠 */}
      <div style={{
        flex: 1, minWidth: 0, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            alignSelf: 'flex-start',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 8, border: `1px solid ${theme.border}`,
            fontSize: 13, fontWeight: 600, color: theme.textMuted,
            cursor: 'pointer', background: 'transparent', fontFamily: 'inherit',
          }}
        >
          ← 이전으로
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StockLogo name={stock.name} code={stock.code} size={48} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800 }}>{stock.name}</span>
              <span style={{ fontSize: 13, color: theme.textMuted, fontWeight: 500 }}>{stock.code}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* 알림 아이콘 */}
                <div
                  onClick={() => setAlerted(v => !v)}
                  style={{
                    width: 34, height: 34, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 17,
                    background: alerted ? theme.aiSoft : theme.panel2,
                    border: `1px solid ${alerted ? theme.ai : theme.border}`,
                    color: alerted ? theme.ai : theme.textMuted,
                    transition: 'all 0.2s',
                  }}
                >🔔</div>
                {/* 즐겨찾기 아이콘 */}
                <div
                  onClick={() => setLiked(v => !v)}
                  style={{
                    width: 34, height: 34, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 17,
                    background: liked ? 'rgba(239,68,68,0.08)' : theme.panel2,
                    border: `1px solid ${liked ? '#ef4444' : theme.border}`,
                    transition: 'all 0.2s',
                  }}
                >{liked ? '❤️' : '🤍'}</div>
              </div>
            </div>
            {stock.sector && (
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                fontSize: 12, fontWeight: 600, color: theme.ai,
                background: theme.aiSoft, border: `1px solid ${theme.ai}`,
                borderRadius: 6, padding: '2px 8px', alignSelf: 'flex-start',
              }}>
                {stock.sector}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.01em' }}>
            {stock.current_price != null ? `${stock.current_price.toLocaleString()}원` : '-'}
          </div>
          {changePct != null && stock.current_price != null && (
            <div style={{ fontSize: 14, fontWeight: 700, color: changePct >= 0 ? theme.up : theme.down }}>
              {(() => {
                const changeWon = Math.round(priceNum * changePct / (100 + changePct));
                const sign = changePct >= 0 ? '+' : '';
                return `어제보다 ${sign}${changeWon.toLocaleString()}원 (${Math.abs(changePct).toFixed(1)}%)`;
              })()}
            </div>
          )}
          <div style={{ fontSize: 12, color: theme.textMuted }}>
            거래량 {stock.volume != null ? stock.volume.toLocaleString() : '-'}
          </div>
        </div>

        {/* 차트 */}
        <div style={{
          background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: 12, height: 260, display: 'flex', flexDirection: 'column',
          // 세로 flex 안에서 내용이 길어져도 차트 박스가 줄어들어 높이가 0이 되지 않게 한다
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: `1px solid ${theme.border}` }}>
            {periods.map(p => (
              <div key={p} onClick={() => setPeriod(p)} style={{
                fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                background: period === p ? theme.ai : 'transparent',
                color: period === p ? theme.aiText : theme.textMuted,
              }}>{p}</div>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {candlesStatus === 'ready' && candles.length > 0 ? (
              <CandleChart data={candles} theme={theme} />
            ) : (
              <div style={{
                height: '100%', display: 'flex', flexDirection: 'column', gap: 8,
                alignItems: 'center', justifyContent: 'center', color: theme.textMuted, fontSize: 13,
              }}>
                {candlesStatus === 'loading' && '차트 데이터를 불러오는 중...'}
                {candlesStatus === 'ready' && '표시할 차트 데이터가 없습니다'}
                {candlesStatus === 'error' && (
                  <>
                    <span>차트 데이터를 불러오지 못했습니다</span>
                    <button
                      onClick={() => setCandlesReloadKey(k => k + 1)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, border: `1px solid ${theme.border}`,
                        fontSize: 12, fontWeight: 600, color: theme.ai,
                        cursor: 'pointer', background: 'transparent', fontFamily: 'inherit',
                      }}
                    >
                      다시 시도
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 주문 + 호가 */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{
            flex: 1, background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>모의 매수 / 매도</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['buy', 'sell'] as const).map(s => (
                <div key={s} onClick={() => setSide(s)} style={{
                  flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 8,
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  background: side === s ? (s === 'buy' ? theme.up : theme.down) : 'transparent',
                  color: side === s ? theme.bg : (s === 'buy' ? theme.up : theme.down),
                  border: `1px solid ${s === 'buy' ? theme.up : theme.down}`,
                }}>
                  {s === 'buy' ? '매수' : '매도'}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: theme.textMuted }}>
              <span>수량</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>-</div>
                <span style={{ color: theme.text, fontWeight: 600, minWidth: 32, textAlign: 'center' }}>{qty}주</span>
                <div onClick={() => setQty(q => q + 1)} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>+</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: theme.textMuted }}>
              <span>주문금액</span>
              <span style={{ color: theme.text, fontWeight: 600 }}>{total.toLocaleString()}원</span>
            </div>
            <div onClick={handleOrder} style={{
              textAlign: 'center', padding: '10px 0', borderRadius: 8,
              background: side === 'buy' ? theme.up : theme.down,
              color: theme.bg, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
              {side === 'buy' ? '매수' : '매도'} 주문 실행
            </div>
          </div>

          <div style={{
            flex: 1, background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>호가</div>
            {orderbook.map((o, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 12, padding: '3px 0',
                color: o.dir === 'down' ? theme.down : o.dir === 'up' ? theme.up : theme.textMuted,
              }}>
                <span>{o.price}</span><span>{o.qty}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 뉴스 */}
        <div style={{
          background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>최근 뉴스</div>
          {newsStatus === 'loading' && <div style={{ fontSize: 12, color: theme.textMuted }}>뉴스를 불러오는 중...</div>}
          {newsStatus === 'error' && <div style={{ fontSize: 12, color: theme.textMuted }}>뉴스를 불러오지 못했습니다</div>}
          {newsStatus === 'ready' && news.length === 0 && <div style={{ fontSize: 12, color: theme.textMuted }}>관련 뉴스가 없습니다</div>}
          {news.map(n => (
            <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              padding: '10px 0', borderBottom: `1px solid ${theme.border}`,
              color: 'inherit', textDecoration: 'none',
            }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
              <div style={{ fontSize: 11, color: theme.textMuted }}>{n.source ?? ''} · {timeAgo(n.published_at)}</div>
            </a>
          ))}
        </div>
      </div>

      {/* 우측 패널 (탭) */}
      <div style={{
        width: 300, flexShrink: 0,
        borderLeft: `1px solid ${theme.border}`,
        background: theme.panel,
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0,
        height: 'calc(100vh - 64px)', overflowY: 'auto',
      }}>
        {/* 탭 */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
          {([['insight', 'AI 인사이트'], ['portfolio', '내 모의매매']] as const).map(([key, label]) => (
            <div
              key={key}
              onClick={() => setRightTab(key)}
              style={{
                flex: 1, textAlign: 'center', padding: '14px 0',
                fontSize: 13, fontWeight: rightTab === key ? 700 : 500,
                color: rightTab === key ? theme.ai : theme.textMuted,
                borderBottom: rightTab === key ? `2px solid ${theme.ai}` : '2px solid transparent',
                cursor: 'pointer',
              }}
            >{label}</div>
          ))}
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* AI 인사이트 탭 */}
          {rightTab === 'insight' && <>
            {/* 등락 이유 */}
            <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>등락 이유</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>{mockStock?.aiReason ?? 'AI 분석 기능은 아직 준비 중입니다.'}</div>
            </div>

            {/* AI별 추천 코멘트 */}
            {(() => {
              const insights = stockAiInsights.filter(i => i.stockName === stock.name);
              if (insights.length === 0) return null;
              return <>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>AI별 코멘트</div>
                {insights.map((ins, idx) => {
                  const signalColor = ins.signal === '매수' ? theme.up : ins.signal === '매도' ? theme.down : theme.textMuted;
                  return (
                    <div key={idx} style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: theme.aiSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          <img src={ins.icon} alt={ins.bot} width={16} height={16} style={{ objectFit: 'contain' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{ins.bot}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: signalColor, border: `1px solid ${signalColor}`, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>{ins.signal}</span>
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.6, color: theme.text }}>{ins.comment}</div>

                      {ins.sources.length > 0 && (
                        <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, letterSpacing: '0.03em' }}>근거 뉴스</div>
                          {ins.sources.map((src, si) => (
                            <div key={si} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 500, color: theme.text, lineHeight: 1.4 }}>· {src.title}</div>
                              <div style={{ fontSize: 10, color: theme.textMuted }}>{src.source} · {src.time}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>;
            })()}

            {/* 유사 종목 */}
            {mockStock && mockStock.similar.length > 0 && <>
            <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>유사 종목</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {mockStock.similar.map(name => (
                <div key={name} style={{ padding: '5px 10px', borderRadius: 20, border: `1px solid ${theme.border}`, fontSize: 12, color: theme.textMuted, cursor: 'pointer' }}
                  onClick={() => { const s = stocks.find(s => s.name === name); if (s) navigate(`/stock/${s.code}`); }}>
                  {name}
                </div>
              ))}
            </div>
            </>}
          </>}

          {/* 내 모의매매 탭 */}
          {rightTab === 'portfolio' && <>
            {/* AI 추천 카드 */}
            {showRec && (
              <div
                onClick={() => navigate(`/stock/${recCode}`)}
                style={{
                  background: theme.ai, borderRadius: 14, padding: '18px 16px',
                  display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer',
                  position: 'relative', overflow: 'hidden', minHeight: 180,
                }}
              >
                <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ position: 'absolute', right: 20, bottom: -30, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

                <div key={`rec-header-${activeRec}`} className="ai-rec-slide" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    <img src={rec.icon} alt={rec.bot} width={20} height={20} style={{ objectFit: 'contain' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{rec.bot}</span>
                  <div onClick={e => { e.stopPropagation(); setShowRec(false); }} style={{ marginLeft: 'auto', width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}>✕</div>
                </div>

                <div key={`rec-body-${activeRec}`} className="ai-rec-slide">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <StockLogo name={rec.stockName} code={recCode} size={20} />
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{rec.stockName}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: recMockPct >= 0 ? '#fca5a5' : '#93c5fd' }}>{recChangeLabel}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, wordBreak: 'keep-all' }}>{rec.reason}</div>
                </div>
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 700, color: theme.ai, background: theme.aiSoft, borderRadius: 8, padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.ai}` }}>
              ✦ 내 모의매매
            </div>

            <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>총 평가자산</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{mockPortfolio.totalAsset.toLocaleString()}원</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: theme.textMuted }}>수익</span>
                <span style={{ fontWeight: 700, color: theme.up }}>+{mockPortfolio.totalProfit.toLocaleString()}원 ({mockPortfolio.profitRate.toFixed(2)}%)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: theme.textMuted }}>가상현금</span>
                <span style={{ fontWeight: 600 }}>{mockPortfolio.balance.toLocaleString()}원</span>
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>보유 종목</div>
            {holdings.map(h => {
              const changeColor = h.changePct >= 0 ? theme.up : theme.down;
              const changeLabel = (h.changePct >= 0 ? '▲' : '▼') + Math.abs(h.changePct).toFixed(1) + '%';
              const hStock = stocks.find(s => s.name === h.name);
              return (
                <div key={h.name} onClick={() => hStock && navigate(`/stock/${hStock.code}`)} style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <StockLogo name={h.name} code={hStock?.code} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{h.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: changeColor, flexShrink: 0, marginLeft: 6 }}>{changeLabel}</span>
                    </div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{h.qty}</div>
                  </div>
                </div>
              );
            })}

            <div onClick={() => navigate('/portfolio')} style={{ textAlign: 'center', padding: '9px 0', borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 12, fontWeight: 600, color: theme.textMuted, cursor: 'pointer', marginTop: 4 }}>
              전체 포트폴리오 보기
            </div>
          </>}
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? theme.up : theme.down,
          borderRadius: 10, padding: '12px 20px', fontSize: 13, fontWeight: 600,
          color: theme.bg, boxShadow: '0 8px 24px rgba(0,0,0,.3)', zIndex: 50, whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

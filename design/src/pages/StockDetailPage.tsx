import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { CandlestickData } from 'lightweight-charts';
import { useTheme } from '../context/ThemeContext';
import StockLogo from '../components/StockLogo';
import CandleChart from '../components/CandleChart';
import PostFeed from '../components/PostFeed';
import OrderbookLevels from '../components/stock/OrderbookLevels';
import OrderbookModal from '../components/stock/OrderbookModal';
import StockOrderList from '../components/stock/StockOrderList';
import StockInfoTab from '../components/stock/StockInfoTab';
import StockNewsTab from '../components/stock/StockNewsTab';
import AiInsightTab from '../components/stock/AiInsightTab';
import MyTradingTab from '../components/stock/MyTradingTab';
import OrderBox, { type OrderPriceType } from '../components/stock/OrderBox';
import {
  cancelOrder, createOrder, createStockAnalysis, fetchStockAnalysis, fetchStockByCode, fetchStockCandles, fetchStockInfo, fetchStockNews, fetchStockOrderbook, fetchStockRankings, getOrders, getPortfolio,
  type ApiAiAnalysis, type ApiNewsItem, type ApiOrder, type ApiOrderbook, type ApiStockRanking, type ApiPortfolio, type ApiStockDetail, type ApiStockInfo,
} from '../lib/api';
import { useViewport } from '../lib/useViewport';

// 탭 이름은 막대 하나의 단위다. 일 = 일봉, 주 = 주봉, 월 = 월봉, 년 = 년봉.
// count는 서버에서 가져올 막대 개수(넉넉히 요청하면 있는 만큼 전부 온다), visibleBars는 처음 화면에 보여줄 최근 막대 개수.
// 나머지는 차트를 드래그하거나 확대·축소해서 본다.
const periods = ['일', '주', '월', '년'] as const;
type Period = (typeof periods)[number];

const PERIOD_PARAMS: Record<Period, { interval: '1d' | '1w' | '1mo' | '1y'; count: number; visibleBars: number }> = {
  '일': { interval: '1d', count: 2000, visibleBars: 60 },
  '주': { interval: '1w', count: 500, visibleBars: 52 },
  '월': { interval: '1mo', count: 150, visibleBars: 36 },
  '년': { interval: '1y', count: 30, visibleBars: 30 },
};

// 상세페이지가 현재가와 마지막 막대를 다시 받아오는 주기. 백엔드의 현재가·오늘 봉 캐시도 같은 3초다.
const POLL_INTERVAL_MS = 3000;
// 호가 패널에 보여줄 매도/매수 단계 수 (서버는 각 10단계까지 준다)
const ORDERBOOK_LEVELS = 5;

type ChartCandle = CandlestickData<string>;

export default function StockDetailPage() {
  const { theme } = useTheme();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  // 지정가/시장가와 지정가 금액은 호가를 눌러서도 바뀌므로 주문창(OrderBox) 대신 여기서 들고 있는다
  const [orderType, setOrderType] = useState<OrderPriceType>('limit');
  const [inputPrice, setInputPrice] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [period, setPeriod] = useState<Period>('일');
  const [liked, setLiked] = useState(false);
  const [alerted, setAlerted] = useState(false);
  const [mainTab, setMainTab] = useState<'chart' | 'info' | 'news' | 'community'>('chart');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [rightTab, setRightTab] = useState<'insight' | 'portfolio'>('insight');
  const { isMobile, isCompact } = useViewport();

  // 종목 정보·차트·호가·종목정보·뉴스·주문·내 모의매매는 실제 API, AI 인사이트는 아직 목업
  const [stock, setStock] = useState<ApiStockDetail | null>(null);
  const [stockStatus, setStockStatus] = useState<'loading' | 'ready' | 'notFound' | 'error'>('loading');
  const [orderbookExpanded, setOrderbookExpanded] = useState(false);
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  // 폴링으로 받은 마지막 막대. 차트를 다시 그리지 않고 마지막 막대만 갱신한다
  const [liveBar, setLiveBar] = useState<ChartCandle | null>(null);
  const [candlesStatus, setCandlesStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [candlesReloadKey, setCandlesReloadKey] = useState(0);
  const [orderbook, setOrderbook] = useState<ApiOrderbook | null>(null);
  const [orderbookStatus, setOrderbookStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [info, setInfo] = useState<ApiStockInfo | null>(null);
  const [infoStatus, setInfoStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [news, setNews] = useState<ApiNewsItem[]>([]);
  const [newsStatus, setNewsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [analysis, setAnalysis] = useState<ApiAiAnalysis | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<ApiPortfolio | null>(null);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [rankings, setRankings] = useState<ApiStockRanking[]>([]);

  // 내 모의매매 탭의 AI 추천 카드용 실분석 (랭킹 API의 최신 insights)
  useEffect(() => {
    let cancelled = false;
    fetchStockRankings()
      .then(data => { if (!cancelled) setRankings(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setStockStatus('loading');
    fetchStockByCode(code)
      .then(data => {
        if (cancelled) return;
        setStock(data);
        setStockStatus(data ? 'ready' : 'notFound');
        // 지정가 초기값은 종목을 처음 불러왔을 때의 현재가
        if (data?.current_price) setInputPrice(data.current_price);
      })
      .catch(() => { if (!cancelled) setStockStatus('error'); });
    return () => { cancelled = true; };
  }, [code]);

  // 3초 폴링이 stock 객체를 계속 새로 만들므로, 뉴스·차트는 종목이 바뀔 때만 다시 받도록 id에 의존시킨다
  const stockId = stock?.id;
  // 분석 응답이 늦게 오는 사이 다른 종목으로 옮겼는지 확인하는 용도
  const stockIdRef = useRef(stockId);
  stockIdRef.current = stockId;

  useEffect(() => {
    if (stockId == null) return;
    let cancelled = false;
    setNewsStatus('loading');
    fetchStockNews(stockId)
      .then(data => {
        if (cancelled) return;
        setNews(data);
        setNewsStatus('ready');
      })
      .catch(() => { if (!cancelled) setNewsStatus('error'); });
    return () => { cancelled = true; };
  }, [stockId]);

  useEffect(() => {
    if (stockId == null) return;
    let cancelled = false;
    setAnalysisStatus('loading');
    setAnalyzeError(null);
    // 이전 종목에서 돌리던 분석은 이 종목과 무관하므로 버튼을 다시 누를 수 있게 한다
    setAnalyzing(false);
    fetchStockAnalysis(stockId)
      .then(data => {
        if (cancelled) return;
        setAnalysis(data);
        setAnalysisStatus(data ? 'ready' : 'empty');
      })
      .catch(() => {
        if (cancelled) return;
        setAnalysis(null);
        setAnalysisStatus('error');
      });
    return () => { cancelled = true; };
  }, [stockId]);

  async function handleRunAnalysis() {
    if (stockId == null || analyzing) return;
    const requestedId = stockId;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const data = await createStockAnalysis(requestedId);
      // 응답을 기다리는 동안 다른 종목으로 옮겼으면 그 화면에 결과를 띄우지 않는다
      if (stockIdRef.current !== requestedId) return;
      setAnalysis(data);
      setAnalysisStatus('ready');
      fetchStockRankings().then(setRankings).catch(() => {});
    } catch (err) {
      if (stockIdRef.current !== requestedId) return;
      setAnalyzeError(err instanceof Error ? err.message : 'AI 분석에 실패했습니다');
    } finally {
      if (stockIdRef.current === requestedId) setAnalyzing(false);
    }
  }

  useEffect(() => {
    if (stockId == null) return;
    let cancelled = false;
    const { interval, count } = PERIOD_PARAMS[period];
    setCandlesStatus('loading');
    setLiveBar(null);
    fetchStockCandles(stockId, interval, count)
      .then(data => {
        if (cancelled) return;
        setCandles(data.map(c => ({
          time: c.timestamp.slice(0, 10),
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
  }, [stockId, period, candlesReloadKey]);

  // 3초마다 현재가·등락률·거래량과 마지막 막대를 다시 받는다.
  // 탭이 숨겨져 있으면 건너뛰고, 앞 요청이 끝나기 전이면 이번 주기는 건너뛴다.
  useEffect(() => {
    if (!code || stockId == null) return;
    const { interval } = PERIOD_PARAMS[period];
    let inFlight = false;
    let cancelled = false;

    const tick = async () => {
      if (document.visibilityState !== 'visible' || inFlight) return;
      inFlight = true;
      try {
        const [found, bars] = await Promise.all([
          fetchStockByCode(code),
          fetchStockCandles(stockId, interval, 1),
        ]);
        if (cancelled) return;
        if (found) setStock(found);
        const last = bars[bars.length - 1];
        if (last) {
          setLiveBar({ time: last.timestamp.slice(0, 10), open: last.open, high: last.high, low: last.low, close: last.close });
        }
      } catch {
        // 일시적인 실패는 무시하고 다음 주기에 다시 시도한다
      } finally {
        inFlight = false;
      }
    };

    const timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [code, stockId, period]);

  useEffect(() => {
    if (stockId == null) return;
    let cancelled = false;
    setInfo(null);
    setInfoStatus('loading');
    fetchStockInfo(stockId)
      .then(data => {
        if (cancelled) return;
        setInfo(data);
        setInfoStatus('ready');
      })
      .catch(() => { if (!cancelled) setInfoStatus('error'); });
    return () => { cancelled = true; };
  }, [stockId]);

  // 호가도 같은 주기로 다시 받는다. 받아 둔 호가가 있으면 일시적인 실패로 패널을 비우지 않는다.
  useEffect(() => {
    if (stockId == null) return;
    let inFlight = false;
    let cancelled = false;
    setOrderbook(null);
    setOrderbookStatus('loading');

    const load = async () => {
      if (document.visibilityState !== 'visible' || inFlight) return;
      inFlight = true;
      try {
        const data = await fetchStockOrderbook(stockId);
        if (cancelled) return;
        setOrderbook(data);
        setOrderbookStatus('ready');
      } catch {
        if (!cancelled) setOrderbookStatus(prev => (prev === 'ready' ? prev : 'error'));
      } finally {
        inFlight = false;
      }
    };

    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [stockId]);

  // 잔고·보유 종목·주문 내역은 주문할 때마다 바뀌므로 주문 후에도 다시 불러온다
  const loadAccountData = useCallback(() => {
    getPortfolio().then(res => setPortfolio(res.data)).catch(() => setPortfolio(null));
    getOrders().then(res => setOrders(res.data)).catch(() => setOrders([]));
  }, []);
  useEffect(() => { loadAccountData(); }, [loadAccountData]);

  // 미체결 주문은 서버가 호가를 보고 체결하므로, 남아 있는 동안에는 주기적으로 다시 확인한다
  const hasPendingOrders = orders.some(o => o.status === 'PENDING');
  useEffect(() => {
    if (!hasPendingOrders) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') loadAccountData();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasPendingOrders, loadAccountData]);

  const priceNum = stock?.current_price ?? 0;

  // 미체결 주문에 묶인 수량·금액은 빼고 계산한다
  const heldQty = portfolio?.holdings.find(h => h.stock_code === code)?.orderable_quantity ?? 0;
  const stockOrders = orders.filter(o => o.stock_code === code);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2600);
  };

  const handleOrder = async (orderSide: 'buy' | 'sell', qty: number) => {
    if (!stock || submitting) return;
    if (orderType === 'limit' && inputPrice <= 0) {
      showToast('지정가를 입력해주세요', false);
      return;
    }
    setSubmitting(true);
    try {
      const res = await createOrder({
        stock_id: stock.id,
        order_type: orderSide === 'buy' ? 'BUY' : 'SELL',
        price_type: orderType === 'market' ? 'MARKET' : 'LIMIT',
        quantity: qty,
        ...(orderType === 'limit' ? { price: inputPrice } : {}),
      });
      const o = res.data;
      const sideLabel = orderSide === 'buy' ? '매수' : '매도';
      showToast(
        o.status === 'PENDING'
          ? `${sideLabel} 주문 접수: ${o.stock_name} ${o.quantity}주 · 지정가 ${o.price.toLocaleString()}원 (지정가에 닿으면 체결돼요)`
          : `${sideLabel} 체결: ${o.stock_name} ${o.quantity}주 · ${o.price.toLocaleString()}원 (총 ${o.total_amount.toLocaleString()}원)`,
        true,
      );
      loadAccountData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '주문에 실패했습니다', false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (orderId: number) => {
    try {
      await cancelOrder(orderId);
      showToast('주문을 취소했어요', true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '주문 취소에 실패했습니다', false);
    }
    loadAccountData();
  };

  // 호가를 누르면 그 가격으로 지정가 주문을 넣을 수 있게 채워준다
  const pickOrderbookPrice = (price: number) => {
    setOrderType('limit');
    setInputPrice(price);
    setOrderbookExpanded(false);
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
          <button onClick={() => navigate('/dashboard')} style={{ alignSelf: 'flex-start', color: theme.ai, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
            ← 홈으로
          </button>
        )}
      </div>
    );
  }

  const changePct = stock.change_rate != null ? stock.change_rate * 100 : null;

  return (
    // 좁은 화면에서는 우측 패널을 본문 아래로 내린다. 휴대폰에서는 아래에 붙은 주문창 높이만큼 여백을 둔다
    <div style={{
      display: 'flex', minHeight: '100%',
      flexDirection: isCompact ? 'column' : 'row', alignItems: isCompact ? 'stretch' : 'flex-start',
      paddingBottom: isMobile ? 56 : 0,
    }}>
      {/* 메인 콘텐츠 */}
      <div style={{
        flex: 1, minWidth: 0, padding: isMobile ? 16 : 24,
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
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
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                {/* 즐겨찾기 아이콘 */}
                <div
                  onClick={() => setLiked(v => !v)}
                  style={{
                    width: 34, height: 34, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    background: liked ? 'rgba(239,68,68,0.08)' : theme.panel2,
                    border: `1px solid ${liked ? '#ef4444' : theme.border}`,
                    color: liked ? '#ef4444' : theme.textMuted,
                    transition: 'all 0.2s',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? '#ef4444' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </div>
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

        <div style={{ display: 'flex', alignItems: 'baseline', gap: isMobile ? 8 : 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: isMobile ? 26 : 30, fontWeight: 800, letterSpacing: '-0.01em' }}>
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

        {/* 카테고리 탭 바 */}
        <div className="hide-scrollbar" style={{ display: 'flex', borderBottom: `1px solid ${theme.border}`, marginBottom: -8, overflowX: 'auto' }}>
          {([
            ['chart', '차트 · 호가'],
            ['info', '종목정보'],
            ['news', '뉴스 · 공시'],
            ['community', '커뮤니티'],
          ] as const).map(([key, label]) => (
            <div
              key={key}
              onClick={() => setMainTab(key)}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: mainTab === key ? 700 : 500,
                color: mainTab === key ? theme.ai : theme.textMuted,
                borderBottom: mainTab === key ? `2px solid ${theme.ai}` : '2px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >{label}</div>
          ))}
        </div>

        {/* 차트 · 호가 탭 */}
        {mainTab === 'chart' && <>
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
                <CandleChart data={candles} theme={theme} visibleBars={PERIOD_PARAMS[period].visibleBars} liveBar={liveBar} />
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

          <div style={{ display: 'flex', gap: 16, alignItems: isMobile ? 'stretch' : 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
            {/* 호가 */}
            <div style={{
              flex: 1, background: theme.panel, border: `1px solid ${theme.border}`,
              borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>호가</div>
                <div
                  onClick={() => setOrderbookExpanded(true)}
                  title="호가 크게 보기"
                  style={{
                    width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: theme.textMuted,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </div>
              </div>
              <OrderbookLevels orderbook={orderbook} status={orderbookStatus} levelCount={ORDERBOOK_LEVELS} large={false} onPick={pickOrderbookPrice} />
            </div>

            <StockOrderList orders={stockOrders} onCancel={handleCancel} />
          </div>
        </>}

        {/* 종목정보 탭 */}
        {mainTab === 'info' && <StockInfoTab stock={stock} info={info} status={infoStatus} />}

        {/* 뉴스 · 공시 탭 */}
        {mainTab === 'news' && <StockNewsTab news={news} status={newsStatus} />}

        {/* 커뮤니티 탭 */}
        {mainTab === 'community' && <PostFeed stockId={stock.id} stockName={stock.name} />}
      </div>

      {/* 우측 패널 (탭) */}
      <div style={{
        background: theme.panel,
        display: 'flex', flexDirection: 'column',
        ...(isCompact
          ? { borderTop: `1px solid ${theme.border}` }
          : {
              width: 300, flexShrink: 0,
              borderLeft: `1px solid ${theme.border}`,
              position: 'sticky', top: 0,
              height: 'calc(100vh - 64px)', overflowY: 'auto',
            }),
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
          {rightTab === 'insight' && (
            <AiInsightTab
              code={code}
              analysis={analysis}
              status={analysisStatus}
              analyzing={analyzing}
              error={analyzeError}
              onRun={handleRunAnalysis}
            />
          )}

          {/* 내 모의매매 탭 */}
          {rightTab === 'portfolio' && <MyTradingTab rankings={rankings} portfolio={portfolio} />}
        </div>
      </div>

      {/* 플로팅 주문 박스 */}
      <OrderBox
        stockName={stock.name}
        currentPrice={priceNum}
        orderType={orderType}
        onOrderTypeChange={setOrderType}
        inputPrice={inputPrice}
        setInputPrice={setInputPrice}
        orderableBalance={portfolio?.orderable_balance ?? null}
        heldQty={heldQty}
        submitting={submitting}
        onOrder={handleOrder}
      />

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          // 실패 알림은 주가 등락 색(빨강/파랑)과 헷갈리지 않게 중립색으로 보여준다
          background: toast.ok ? theme.up : theme.text,
          borderRadius: 10, padding: '12px 20px', fontSize: 13, fontWeight: 600,
          color: theme.bg, boxShadow: '0 8px 24px rgba(0,0,0,.3)', zIndex: 50, whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}

      {/* 호가 크게 보기 */}
      {orderbookExpanded && (
        <OrderbookModal
          stock={stock}
          currentPrice={priceNum}
          orderbook={orderbook}
          status={orderbookStatus}
          onPick={pickOrderbookPrice}
          onClose={() => setOrderbookExpanded(false)}
        />
      )}
    </div>
  );
}

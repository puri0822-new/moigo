import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import StockLogo from '../components/StockLogo';
import AiRecCard from '../components/AiRecCard';
import AiIcon from '../components/AiIcon';
import { useAiRecommendations } from '../lib/aiRecommendations';
import { findAiProfile, useAiModels } from '../lib/aiModels';
import { addWatchlist, apiGet, createOrder, fetchSimilarStocks, fetchStockAiReason, fetchStockByCode, fetchStockCandles, fetchStockNews, fetchStockOrderbook, fetchWatchlist, removeWatchlist, setWatchAlert } from '../lib/api';
import type { ApiCandle, ApiNewsItem, ApiOrderbook, ApiStock, ApiStockAiReason } from '../lib/api';
import { timeAgo } from '../lib/time';
import { usePolling, PORTFOLIO_POLL_MS } from '../lib/usePolling';
import CandleChart from '../components/CandleChart';
import PostFeed from '../components/PostFeed';
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';

// 탭 이름은 막대 하나의 단위다. 분 = 오늘 1분봉, 일 = 일봉, 주 = 주봉, 월 = 월봉, 년 = 년봉.
// count는 서버에서 가져올 막대 개수, visibleBars는 처음 화면에 보여줄 최근 막대 개수 (드래그·휠로 나머지를 본다).
const periods = ['분', '일', '주', '월', '년'] as const;
type Period = (typeof periods)[number];
type ChartInterval = '1m' | '1d' | '1w' | '1mo' | '1y';
type ChartCandle = CandlestickData<UTCTimestamp | string>;

const PERIOD_PARAMS: Record<Period, { interval: ChartInterval; count: number; visibleBars: number }> = {
  '분': { interval: '1m', count: 200, visibleBars: 200 },
  '일': { interval: '1d', count: 2000, visibleBars: 60 },
  '주': { interval: '1w', count: 500, visibleBars: 52 },
  '월': { interval: '1mo', count: 150, visibleBars: 36 },
  '년': { interval: '1y', count: 30, visibleBars: 30 },
};

// 현재가 옆 등락 문구의 기준. 분·일은 전일 종가, 주·월·년은 바로 앞 주·달·해 마지막 거래일 종가
const COMPARE_LABEL: Record<Period, string> = { '분': '어제보다', '일': '어제보다', '주': '지난주보다', '월': '지난달보다', '년': '작년보다' };

// 차트 라이브러리는 시각을 UTC로 표시하므로, 분봉은 한국 시간(UTC+9)만큼 더해서 넣어야 축과 십자선에 한국 시각이 보인다
const KST_OFFSET_SECONDS = 9 * 60 * 60;

// 분봉은 시각(초)으로, 나머지는 날짜 문자열로 차트에 넣는다
function toChartCandle(c: ApiCandle, interval: ChartInterval): ChartCandle {
  return {
    time: interval === '1m'
      ? (Math.floor(new Date(c.timestamp).getTime() / 1000) + KST_OFFSET_SECONDS) as UTCTimestamp
      : c.timestamp.slice(0, 10),
    open: c.open, high: c.high, low: c.low, close: c.close,
  };
}

// 호가를 다시 받아오는 주기. 백엔드의 호가 캐시는 2초다.
const POLL_INTERVAL_MS = 3000;
// 호가 패널에 보여줄 매도/매수 단계 수 (서버는 각 10단계까지 준다)
const ORDERBOOK_LEVELS = 5;

interface HoldingItem {
  stock_id: number;
  stock_name: string;
  stock_code: string;
  quantity: number;
  avg_price: number;
  eval_amount: number;
  profit_loss: number;
  profit_loss_rate: number;
}

interface PortfolioData {
  balance: number;
  total_eval_amount: number;
  total_profit_loss: number;
  total_profit_loss_rate: number;
  holdings: HoldingItem[];
}

export default function StockDetailPage() {
  const { theme } = useTheme();
  const { code } = useParams<{ code: string }>();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [inputPrice, setInputPrice] = useState(0);
  const [qty, setQty] = useState(1);
  const [period, setPeriod] = useState<Period>('분');
  const [liked, setLiked] = useState(false);
  // 회원 설정에서 급등락 알림을 껐으면 하트를 눌러도 알림 여부를 묻지 않는다
  const [priceAlertEnabled, setPriceAlertEnabled] = useState(true);
  const [askAlert, setAskAlert] = useState(false);
  const [mainTab, setMainTab] = useState<'chart' | 'info' | 'news' | 'community'>('chart');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [rightTab, setRightTab] = useState<'insight' | 'portfolio'>('insight');
  const [orderHistory, setOrderHistory] = useState<{ side: 'buy' | 'sell'; type: 'limit' | 'market'; price: number; qty: number; total: number; time: string }[]>([]);
  const [floatPos, setFloatPos] = useState({ x: 0, y: 0 });
  const [floatMinimized, setFloatMinimized] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [stockId, setStockId] = useState<number | null>(null);
  const [apiStock, setApiStock] = useState<ApiStock | null>(null);
  const [stockStatus, setStockStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [ordering, setOrdering] = useState(false);
  const [sellWarn, setSellWarn] = useState(false);
  const [confirmOrder, setConfirmOrder] = useState<{ side: 'buy' | 'sell'; price: number; qty: number; total: number } | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [liveChangeRate, setLiveChangeRate] = useState<number | null>(null);
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [liveBar, setLiveBar] = useState<ChartCandle | null>(null);
  const [candlesStatus, setCandlesStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // candles가 어느 탭 데이터인지. 탭을 바꾼 직후 이전 탭 막대로 등락을 잘못 계산하지 않게 한다
  const [candlesPeriod, setCandlesPeriod] = useState<Period | null>(null);
  const [candlesReloadKey, setCandlesReloadKey] = useState(0);
  const [orderbook, setOrderbook] = useState<ApiOrderbook | null>(null);
  const [orderbookStatus, setOrderbookStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [news, setNews] = useState<ApiNewsItem[]>([]);
  const [newsStatus, setNewsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [orderbookExpanded, setOrderbookExpanded] = useState(false);
  const [stockInfo, setStockInfo] = useState<{
    english_name: string | null; isin_code: string | null; market: string | null;
    is_common_share: boolean | null; status: string | null; list_date: string | null;
    shares_outstanding: number | null; nxt_supported: boolean | null; trading_suspended: boolean | null;
  } | null>(null);
  const [stockInfoStatus, setStockInfoStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [aiReason, setAiReason] = useState<ApiStockAiReason | null>(null);
  const [aiReasonStatus, setAiReasonStatus] = useState<'loading' | 'ready'>('loading');
  const [similarStocks, setSimilarStocks] = useState<ApiStock[]>([]);
  const aiModels = useAiModels();
  const { current: currentAiRecs } = useAiRecommendations();
  // 이 종목에 대한, 아직 결과가 나오지 않은 실제 AI 추천 (AI 표시 순서대로)
  const stockRecs = currentAiRecs
    .filter(r => r.stockCode === code)
    .sort((a, b) => aiModels.findIndex(m => m.model === a.aiModel) - aiModels.findIndex(m => m.model === b.aiModel));

  // 등락 이유는 처음 만들 때 AI 호출로 몇 초 걸리므로 다른 데이터와 따로 불러온다
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setAiReason(null);
    setAiReasonStatus('loading');
    fetchStockAiReason(code)
      .then(res => { if (!cancelled) setAiReason(res.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAiReasonStatus('ready'); });
    return () => { cancelled = true; };
  }, [code]);

  useEffect(() => {
    if (stockId === null) return;
    let cancelled = false;
    setSimilarStocks([]);
    fetchSimilarStocks(stockId).then(res => { if (!cancelled) setSimilarStocks(res.data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [stockId]);

  useEffect(() => {
    setFloatPos({ x: window.innerWidth - 316, y: window.innerHeight - 540 });
  }, []);

  const loadPortfolio = useCallback(() => {
    if (!isAuthenticated) return;
    apiGet<PortfolioData>('/portfolio').then(res => setPortfolio(res.data)).catch(() => {});
  }, [isAuthenticated]);

  usePolling(loadPortfolio, PORTFOLIO_POLL_MS, isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || stockId === null) return;
    setLiked(false);
    fetchWatchlist()
      .then(res => {
        setLiked(res.data.items.some(w => w.stock_id === stockId));
        setPriceAlertEnabled(res.data.price_alert_enabled);
      })
      .catch(() => {});
  }, [isAuthenticated, stockId]);

  const toggleLike = async () => {
    if (stockId === null) return;
    const next = !liked;
    setLiked(next);
    try {
      if (next) {
        await addWatchlist(stockId);
        if (priceAlertEnabled) setAskAlert(true);
      } else {
        await removeWatchlist(stockId);
      }
    } catch {
      setLiked(!next);
      showToast('관심 종목을 바꾸지 못했습니다', false);
    }
  };

  const answerAlert = async (enable: boolean) => {
    setAskAlert(false);
    if (!enable || stockId === null) return;
    try {
      await setWatchAlert(stockId, true);
    } catch {
      showToast('알림을 켜지 못했습니다', false);
    }
  };

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setStockId(null);
    setApiStock(null);
    setLivePrice(null);
    setLiveChangeRate(null);
    setStockStatus('loading');
    fetchStockByCode(code)
      .then(s => {
        if (cancelled) return;
        if (!s) { setStockStatus('notfound'); return; }
        setApiStock(s);
        setStockId(s.id);
        if (s.current_price) setLivePrice(s.current_price);
        if (s.change_rate !== null) setLiveChangeRate(s.change_rate);
        setStockStatus('ready');
      })
      .catch(() => { if (!cancelled) setStockStatus('error'); });
    return () => { cancelled = true; };
  }, [code]);

  useEffect(() => {
    if (stockId === null) return;
    let cancelled = false;
    const { interval, count } = PERIOD_PARAMS[period];
    setCandlesStatus('loading');
    setLiveBar(null);
    fetchStockCandles(stockId, interval, count).then(raw => {
      if (cancelled) return;
      setCandles(raw.map(c => toChartCandle(c, interval)));
      setCandlesPeriod(period);
      setCandlesStatus('ready');
    }).catch(() => {
      if (cancelled) return;
      setCandles([]);
      setCandlesStatus('error');
    });
    return () => { cancelled = true; };
  }, [stockId, period, candlesReloadKey]);

  // 3초마다 현재가와 마지막 막대만 받아 갱신한다. 차트를 다시 만들지 않아 사용자가 확대·이동한 상태가 유지된다
  useEffect(() => {
    if (!code || stockId === null) return;
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
        if (found) {
          setApiStock(found);
          if (found.current_price) setLivePrice(found.current_price);
          if (found.change_rate !== null) setLiveChangeRate(found.change_rate);
        }
        const last = bars[bars.length - 1];
        if (last) setLiveBar(toChartCandle(last, interval));
      } catch {
        // 일시적인 실패는 다음 주기에 다시 시도한다
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
    if (stockId === null) return;
    let cancelled = false;
    setNews([]);
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

  // 받아 둔 호가가 있으면 일시적인 실패로 패널을 비우지 않는다.
  useEffect(() => {
    if (stockId === null) return;
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

  useEffect(() => {
    if (stockId === null) return;
    setStockInfoStatus('loading');
    apiGet<typeof stockInfo>(`/stocks/${stockId}/info`)
      .then(res => { setStockInfo(res.data); setStockInfoStatus('ready'); })
      .catch(() => setStockInfoStatus('error'));
  }, [stockId]);

  useEffect(() => {
    if (side === 'sell') {
      const holding = portfolio?.holdings.find(h => h.stock_code === code);
      if (!holding || holding.quantity <= 0) setSide('buy');
    }
  }, [portfolio, code, side]);


  const stock = {
    name: apiStock?.name ?? '',
    code: apiStock?.code ?? code ?? '',
    sector: apiStock?.sector ?? null,
    volume: apiStock?.volume != null
      ? (apiStock.volume >= 1_000_000 ? `${(apiStock.volume / 1_000_000).toFixed(1)}M` : `${(apiStock.volume / 1_000).toFixed(0)}K`)
      : '-',
  };
  const priceNum = livePrice ?? 0;
  const changeRate = liveChangeRate !== null ? liveChangeRate * 100 : 0;

  // 지정가 초기값 설정
  useEffect(() => { setInputPrice(priceNum); }, [priceNum]);

  const effectivePrice = orderType === 'market' ? priceNum : inputPrice;
  const total = effectivePrice * qty;


  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2600);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: floatPos.x, origY: floatPos.y };
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setFloatPos({
        x: Math.max(0, Math.min(window.innerWidth - 300, dragRef.current.origX + e.clientX - dragRef.current.startX)),
        y: Math.max(0, Math.min(window.innerHeight - 48, dragRef.current.origY + e.clientY - dragRef.current.startY)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleOrder = async (orderSide?: 'buy' | 'sell') => {
    if (!isAuthenticated) {
      showToast('로그인이 필요합니다', false);
      return;
    }
    if (stockId === null) {
      showToast('종목 정보를 불러오는 중입니다', false);
      return;
    }
    const s = orderSide ?? side;
    setOrdering(true);
    try {
      const res = await createOrder({
        stock_id: stockId,
        order_type: s === 'buy' ? 'BUY' : 'SELL',
        quantity: qty,
        price: effectivePrice,
      });
      const filled = res.data;
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setOrderHistory(prev => [{ side: s, type: orderType, price: filled.price, qty: filled.quantity, total: filled.total_amount, time }, ...prev]);
      showToast(`${s === 'buy' ? '매수' : '매도'} 체결: ${stock.name} ${filled.quantity}주 · ${filled.total_amount.toLocaleString()}원`, true);
      loadPortfolio();
    } catch (e: any) {
      showToast(e.message || '주문에 실패했습니다', false);
    } finally {
      setOrdering(false);
    }
  };

  const renderOrderbook = (levelCount: number, large: boolean) => {
    if (!orderbook) {
      return (
        <div style={{ fontSize: 12, color: theme.textMuted, padding: '20px 0', textAlign: 'center' }}>
          {orderbookStatus === 'error' ? '호가를 불러오지 못했습니다' : '호가를 불러오는 중...'}
        </div>
      );
    }
    // 위에서부터 높은 가격순: 매도호가(현재가에서 먼 것부터) → 매수호가(현재가에 가까운 것부터)
    const asks = orderbook.asks.slice(0, levelCount).reverse();
    const bids = orderbook.bids.slice(0, levelCount);
    if (asks.length === 0 && bids.length === 0) {
      return <div style={{ fontSize: 12, color: theme.textMuted, padding: '20px 0', textAlign: 'center' }}>표시할 호가가 없습니다</div>;
    }
    const maxVolume = Math.max(1, ...asks.map(l => l.volume), ...bids.map(l => l.volume));
    const row = (l: { price: number; volume: number }, rowSide: 'ask' | 'bid') => {
      const color = rowSide === 'ask' ? theme.down : theme.up;
      return (
        <div
          key={`${rowSide}-${l.price}`}
          onClick={() => { setOrderType('limit'); setInputPrice(l.price); setOrderbookExpanded(false); }}
          style={{
            position: 'relative', display: 'flex', justifyContent: 'space-between',
            fontSize: large ? 14 : 12, padding: large ? '7px 10px' : '3px 6px',
            borderRadius: 4, cursor: 'pointer', overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', top: 0, bottom: 0, right: 0,
            width: `${(l.volume / maxVolume) * 100}%`, background: color, opacity: 0.12,
          }} />
          <span style={{ position: 'relative', fontWeight: 600, color }}>{l.price.toLocaleString()}원</span>
          <span style={{ position: 'relative', color: theme.textMuted }}>{l.volume.toLocaleString()}</span>
        </div>
      );
    };
    return <>
      {asks.map(l => row(l, 'ask'))}
      <div style={{ height: 1, background: theme.border, margin: '2px 0' }} />
      {bids.map(l => row(l, 'bid'))}
    </>;
  };

  if (stockStatus !== 'ready') {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: theme.textMuted }}>
          {stockStatus === 'loading' ? '종목 정보를 불러오는 중...' : stockStatus === 'notfound' ? '종목을 찾을 수 없습니다' : '종목 정보를 불러오지 못했습니다'}
        </div>
        {stockStatus !== 'loading' && (
          <div onClick={() => navigate('/dashboard')} style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 600, color: theme.ai, cursor: 'pointer' }}>← 홈으로</div>
        )}
      </div>
    );
  }

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800 }}>{stock.name}</span>
              <span style={{ fontSize: 13, color: theme.textMuted, fontWeight: 500 }}>{stock.code}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* 관심 종목 (하트) */}
                <div
                  onClick={toggleLike}
                  title={liked ? '관심 종목에서 빼기' : '관심 종목에 추가'}
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
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              fontSize: 12, fontWeight: 600, color: theme.ai,
              background: theme.aiSoft, border: `1px solid ${theme.ai}`,
              borderRadius: 6, padding: '2px 8px', alignSelf: 'flex-start',
            }}>
              {stock.sector}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.01em' }}>{priceNum.toLocaleString()}원</div>
          {(() => {
            // 기본은 전일 대비. 주·월·년 탭이면 바로 앞 막대(지난주·지난달·작년)의 종가와 비교한다
            let changeWon = Math.round(priceNum * changeRate / (100 + changeRate));
            let rate = changeRate;
            let label = COMPARE_LABEL['일'];
            if ((period === '주' || period === '월' || period === '년') && candlesPeriod === period && priceNum > 0) {
              const last = candles[candles.length - 1];
              // 실시간 막대가 새 주·달·해로 넘어갔으면 받아 둔 마지막 막대가 바로 앞 기간이다
              const prev = liveBar && last && liveBar.time !== last.time ? last : candles[candles.length - 2];
              if (prev && prev.close > 0) {
                changeWon = priceNum - prev.close;
                rate = (changeWon / prev.close) * 100;
                label = COMPARE_LABEL[period];
              }
            }
            return (
              <div style={{ fontSize: 14, fontWeight: 700, color: rate >= 0 ? theme.up : theme.down }}>
                {`${label} ${rate >= 0 ? '+' : ''}${Math.round(changeWon).toLocaleString()}원 (${Math.abs(rate).toFixed(2)}%)`}
              </div>
            );
          })()}
          <div style={{ fontSize: 12, color: theme.textMuted }}>거래량 {stock.volume}</div>
        </div>

        {/* 카테고리 탭 바 */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${theme.border}`, marginBottom: -8 }}>
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
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', color: theme.textMuted, fontSize: 13 }}>
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

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {/* 호가 */}
            <div style={{
              flex: 1, background: theme.panel, border: `1px solid ${theme.border}`,
              borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>호가</span>
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
              {renderOrderbook(ORDERBOOK_LEVELS, false)}
            </div>

          {/* 주문 내역 */}
          <div style={{ flex: 1, background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>주문 내역</span>
              {orderHistory.length > 0 && (
                <span
                  onClick={() => setOrderHistory([])}
                  style={{ fontSize: 11, color: theme.textMuted, cursor: 'pointer' }}
                >전체 삭제</span>
              )}
            </div>
            {orderHistory.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: theme.textMuted }}>
                주문 내역이 없습니다
              </div>
            ) : (
              <div>
                {/* 헤더 */}
                <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr 1fr 64px', gap: 8, padding: '7px 16px', borderBottom: `1px solid ${theme.border}`, fontSize: 11, fontWeight: 600, color: theme.textMuted }}>
                  <span>구분</span><span>가격</span><span style={{ textAlign: 'center' }}>수량</span><span style={{ textAlign: 'right' }}>금액</span><span style={{ textAlign: 'right' }}>시간</span>
                </div>
                {orderHistory.map((o, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr 1fr 64px', gap: 8, padding: '9px 16px', borderBottom: i < orderHistory.length - 1 ? `1px solid ${theme.border}` : 'none', fontSize: 12, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: o.side === 'buy' ? theme.up : theme.down }}>
                      {o.side === 'buy' ? '매수' : '매도'}
                    </span>
                    <span style={{ color: theme.text }}>
                      {o.type === 'market' ? '시장가' : `${o.price.toLocaleString()}원`}
                    </span>
                    <span style={{ textAlign: 'center', color: theme.text }}>{o.qty.toLocaleString()}주</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{o.total.toLocaleString()}원</span>
                    <span style={{ textAlign: 'right', color: theme.textMuted, fontSize: 11 }}>{o.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        </>}

        {/* 종목정보 탭 */}
        {mainTab === 'info' && (
          <div style={{
            background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>종목정보</div>
            {stockInfoStatus !== 'ready' || !stockInfo ? (
              <div style={{ fontSize: 12, color: theme.textMuted, padding: '20px 0', textAlign: 'center' }}>
                {stockInfoStatus === 'error' ? '종목정보를 불러오지 못했습니다' : '종목정보를 불러오는 중...'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 24 }}>
                {([
                  ['시가총액', stockInfo.shares_outstanding != null && livePrice != null ? (() => {
                    const eok = Math.round(stockInfo.shares_outstanding! * livePrice / 100_000_000);
                    return eok >= 10_000
                      ? `${Math.floor(eok / 10_000).toLocaleString()}조${eok % 10_000 ? ` ${(eok % 10_000).toLocaleString()}억` : ''}원`
                      : `${eok.toLocaleString()}억원`;
                  })() : '-'],
                  ['상장주식수', stockInfo.shares_outstanding != null ? `${stockInfo.shares_outstanding.toLocaleString()}주` : '-'],
                  ['시장', stockInfo.market ?? '-'],
                  ['업종', stock.sector ?? '-'],
                  ['상장일', stockInfo.list_date ?? '-'],
                  ['주식 종류', stockInfo.is_common_share == null ? '-' : stockInfo.is_common_share ? '보통주' : '우선주 등'],
                  ['영문명', stockInfo.english_name ?? '-'],
                  ['ISIN', stockInfo.isin_code ?? '-'],
                  ['거래 상태', stockInfo.trading_suspended ? '거래정지' : stockInfo.status === 'ACTIVE' ? '정상' : stockInfo.status ?? '-'],
                  ['대체거래소(NXT)', stockInfo.nxt_supported == null ? '-' : stockInfo.nxt_supported ? '거래 가능' : '거래 불가'],
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
        )}

        {/* 뉴스 · 공시 탭 */}
        {mainTab === 'news' && (
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
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 0', borderBottom: `1px solid ${theme.border}`,
                color: 'inherit', textDecoration: 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, lineHeight: 1.45,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>{n.source ?? ''} · {timeAgo(n.published_at)}</div>
                </div>
                {n.image_url && (
                  <img
                    src={n.image_url} alt="" loading="lazy" referrerPolicy="no-referrer"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                    style={{
                      width: 96, height: 64, flexShrink: 0, objectFit: 'cover',
                      borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.panel2,
                    }}
                  />
                )}
              </a>
            ))}
          </div>
        )}

        {/* 커뮤니티 탭 */}
        {mainTab === 'community' && apiStock && <PostFeed stockId={apiStock.id} stockName={apiStock.name} />}
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
            {/* 등락 이유 (AI가 오늘 등락률·시장 지수·최신 뉴스로 쓴 것) */}
            <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>오늘 등락 이유</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: aiReason ? undefined : theme.textMuted }}>
                {aiReasonStatus === 'loading' ? 'AI가 오늘 뉴스와 시장 흐름을 읽고 있어요…' : aiReason?.reason ?? 'AI 분석 준비 중입니다'}
              </div>
              {aiReason && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: theme.textMuted }}>
                  <AiIcon model={aiReason.ai_model} size={12} />
                  {findAiProfile(aiModels, aiReason.ai_model).name} · {new Date(aiReason.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
                </div>
              )}
            </div>

            {stockRecs.length === 0 ? (
              <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>
                아직 이 종목을 추천한 AI가 없어요. AI 추천은 평일 장 마감 뒤(16시)에 새로 나옵니다.
              </div>
            ) : <>
              {/* AI 종합 의견 (이 종목에 대한, 아직 결과가 나오지 않은 실제 추천) */}
              {(() => {
                const buyCount = stockRecs.filter(r => r.opinion === 'BUY').length;
                const sellCount = stockRecs.length - buyCount;
                // -1(전부 매도) ~ +1(전부 매수)
                const score = (buyCount - sellCount) / stockRecs.length;
                const pct = ((score + 1) / 2) * 100;
                const gaugeColor = score > 0.2 ? theme.up : score < -0.2 ? theme.down : theme.textMuted;
                const gaugeLabel = score > 0.2 ? '매수 우세' : score < -0.2 ? '매도 우세' : '의견 갈림';
                return (
                  <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>AI 종합 의견</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: gaugeColor }}>{gaugeLabel}</div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <div style={{
                        height: 8, borderRadius: 99,
                        background: `linear-gradient(to right, ${theme.down}, ${theme.textMuted} 50%, ${theme.up})`,
                        opacity: 0.35,
                      }} />
                      <div style={{
                        position: 'absolute', top: '50%', left: `${pct}%`,
                        transform: 'translate(-50%, -50%)',
                        width: 16, height: 16, borderRadius: '50%',
                        background: gaugeColor, border: `3px solid ${theme.panel2}`, boxShadow: `0 0 0 2px ${gaugeColor}`,
                        transition: 'left 0.4s ease',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600 }}>
                      <span style={{ color: theme.down }}>매도 {sellCount}</span>
                      <span style={{ color: theme.textMuted }}>AI {stockRecs.length}개 추천</span>
                      <span style={{ color: theme.up }}>매수 {buyCount}</span>
                    </div>
                  </div>
                );
              })()}

              {/* AI별 코멘트 (추천 이유와 실제 근거 뉴스) */}
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>AI별 코멘트</div>
              {stockRecs.map(rec => {
                const signalColor = rec.opinion === 'BUY' ? theme.up : theme.down;
                return (
                  <div key={rec.id} style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AiIcon model={rec.aiModel} size={20} />
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{findAiProfile(aiModels, rec.aiModel).name}</span>
                      <span style={{ fontSize: 10, color: theme.textMuted }}>{rec.periodType === 'WEEKLY' ? '1주' : '1달'} 추천</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: signalColor, border: `1px solid ${signalColor}`, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
                        {rec.opinion === 'BUY' ? '매수' : '매도'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.6, color: theme.text }}>{rec.reason}</div>

                    {rec.evidence.length > 0 && (
                      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, letterSpacing: '0.03em' }}>근거 뉴스</div>
                        {rec.evidence.map((ev, i) => (
                          <a
                            key={i}
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'flex', flexDirection: 'column', gap: 1, textDecoration: 'none', color: 'inherit', cursor: ev.url ? 'pointer' : 'default' }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 500, color: theme.text, lineHeight: 1.4 }}>· {ev.title}</div>
                            <div style={{ fontSize: 10, color: theme.textMuted }}>
                              {ev.source} · {new Date(ev.publishedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>}

            {/* 유사 종목 (같은 업종) */}
            {similarStocks.length > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>같은 업종 종목</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {similarStocks.map(s => (
                <div key={s.code} style={{ padding: '5px 10px', borderRadius: 20, border: `1px solid ${theme.border}`, fontSize: 12, color: theme.textMuted, cursor: 'pointer' }}
                  onClick={() => navigate(`/stock/${s.code}`)}>
                  {s.name}
                </div>
              ))}
            </div>
          </>}

          {/* 내 모의매매 탭 */}
          {rightTab === 'portfolio' && <>
            {/* AI 추천 카드 (아직 결과가 나오지 않은 실제 추천) */}
            <AiRecCard />

            <div style={{ fontSize: 13, fontWeight: 700, color: theme.ai, background: theme.aiSoft, borderRadius: 8, padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.ai}` }}>
              ✦ 내 모의매매
            </div>

            {isAuthenticated && portfolio ? (() => {
              const totalAsset = portfolio.balance + portfolio.total_eval_amount;
              const totalProfit = portfolio.total_profit_loss;
              const profitRate = portfolio.total_profit_loss_rate;
              const profitColor = totalProfit >= 0 ? theme.up : theme.down;
              return (
                <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>총 평가자산</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{totalAsset.toLocaleString()}원</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: theme.textMuted }}>수익</span>
                    <span style={{ fontWeight: 700, color: profitColor }}>{totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()}원 ({profitRate.toFixed(2)}%)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: theme.textMuted }}>가상현금</span>
                    <span style={{ fontWeight: 600 }}>{portfolio.balance.toLocaleString()}원</span>
                  </div>
                </div>
              );
            })() : (
              <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, fontSize: 13, color: theme.textMuted, textAlign: 'center' }}>
                로그인 후 확인 가능
              </div>
            )}

            <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>보유 종목</div>
            {!isAuthenticated && (
              <div style={{ fontSize: 12, color: theme.textMuted, textAlign: 'center', padding: '12px 0' }}>로그인 후 확인 가능</div>
            )}
            {isAuthenticated && portfolio?.holdings.length === 0 && (
              <div style={{ fontSize: 12, color: theme.textMuted, textAlign: 'center', padding: '12px 0' }}>보유 종목 없음</div>
            )}
            {portfolio?.holdings.map(h => {
              const changeColor = h.profit_loss_rate >= 0 ? theme.up : theme.down;
              const sign = h.profit_loss >= 0 ? '+' : '-';
              return (
                <div key={h.stock_id} onClick={() => navigate(`/stock/${h.stock_code}`)} style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <StockLogo name={h.stock_name} code={h.stock_code} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.stock_name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>{h.eval_amount.toLocaleString()}원</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: theme.textMuted }}>{h.quantity}주</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: changeColor, flexShrink: 0 }}>{sign}{Math.abs(h.profit_loss).toLocaleString()}원 ({Math.abs(h.profit_loss_rate).toFixed(1)}%)</span>
                    </div>
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

      {/* 플로팅 주문 박스 */}
      <div style={{
        position: 'fixed', left: floatPos.x, top: floatPos.y,
        width: 292, zIndex: 40,
        background: theme.panel, border: `1px solid ${theme.border}`,
        borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        overflow: 'hidden',
      }}>
        {/* 드래그 핸들 */}
        <div
          onMouseDown={handleDragStart}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: floatMinimized ? 'none' : `1px solid ${theme.border}`,
            cursor: 'grab', userSelect: 'none', background: theme.panel2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 11, color: theme.textMuted }}>⠿</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{stock.name} 모의주문</span>
          </div>
          <div
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setFloatMinimized(v => !v)}
            style={{ fontSize: 14, color: theme.textMuted, cursor: 'pointer', lineHeight: 1, padding: '2px 4px' }}
          >{floatMinimized ? '▲' : '▼'}</div>
        </div>

        {!floatMinimized && (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
            {/* 매수 / 매도 선택 탭 */}
            {(() => {
              const currentHolding = portfolio?.holdings.find(h => h.stock_code === code);
              const canSell = !!currentHolding && currentHolding.quantity > 0;
              return (<>
                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${theme.border}` }}>
                  {(['buy', 'sell'] as const).map(s => {
                    const disabled = s === 'sell' && !canSell;
                    return (
                      <div key={s} onClick={() => {
                        if (disabled) { setSellWarn(true); setTimeout(() => setSellWarn(false), 2500); return; }
                        setSellWarn(false); setSide(s);
                      }} style={{
                        flex: 1, textAlign: 'center', padding: '9px 0',
                        fontSize: 13, fontWeight: 700,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.35 : 1,
                        background: side === s && !disabled ? (s === 'buy' ? theme.up : theme.down) : 'transparent',
                        color: side === s && !disabled ? theme.bg : theme.textMuted,
                        transition: 'all 0.15s',
                      }}>
                        {s === 'buy' ? '매수' : '매도'}
                      </div>
                    );
                  })}
                </div>
                {sellWarn && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: theme.down, textAlign: 'center', marginTop: -4 }}>
                    보유한 종목이 없어 매도할 수 없습니다
                  </div>
                )}
              </>);
            })()}

            {/* 지정가 / 시장가 탭 */}
            <div style={{ display: 'flex', background: theme.panel2, borderRadius: 8, padding: 3, gap: 3 }}>
              {(['limit', 'market'] as const).map(t => (
                <div key={t} onClick={() => setOrderType(t)} style={{
                  flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 6,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: orderType === t ? theme.panel : 'transparent',
                  color: orderType === t ? theme.text : theme.textMuted,
                  boxShadow: orderType === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}>
                  {t === 'limit' ? '지정가' : '시장가'}
                </div>
              ))}
            </div>

            {/* 가격 입력 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted }}>가격</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '6px 10px', background: orderType === 'market' ? theme.panel2 : 'transparent' }}>
                <div onClick={() => orderType === 'limit' && setInputPrice(p => Math.max(0, p - 100))}
                  style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: orderType === 'limit' ? 'pointer' : 'default', flexShrink: 0, opacity: orderType === 'market' ? 0.4 : 1 }}>-</div>
                {orderType === 'market' ? (
                  <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: theme.textMuted }}>시장가</span>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <input type="text" inputMode="numeric"
                      value={inputPrice === 0 ? '' : inputPrice.toLocaleString()}
                      onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); setInputPrice(raw === '' ? 0 : parseInt(raw, 10)); }}
                      placeholder="0"
                      style={{ width: 0, flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', color: theme.text, fontFamily: 'inherit' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted, flexShrink: 0 }}>원</span>
                  </div>
                )}
                <div onClick={() => orderType === 'limit' && setInputPrice(p => p + 100)}
                  style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: orderType === 'limit' ? 'pointer' : 'default', flexShrink: 0, opacity: orderType === 'market' ? 0.4 : 1 }}>+</div>
              </div>
              {orderType === 'limit' && inputPrice > 0 && inputPrice < priceNum * 0.9 && (
                <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', padding: '4px 0' }}>
                  ⚠ 현재가({priceNum.toLocaleString()}원)보다 가격이 낮습니다
                </div>
              )}
            </div>

            {/* 수량 입력 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted }}>수량</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '6px 10px' }}>
                <div onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>-</div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <input type="text" inputMode="numeric"
                    value={qty === 0 ? '' : qty.toLocaleString()}
                    onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); setQty(raw === '' ? 1 : Math.max(1, parseInt(raw, 10))); }}
                    placeholder="0"
                    style={{ width: 0, flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', color: theme.text, fontFamily: 'inherit' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted, flexShrink: 0 }}>주</span>
                </div>
                <div onClick={() => setQty(q => q + 1)} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>+</div>
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {[['10%', 0.1], ['25%', 0.25], ['50%', 0.5], ['최대', 1]].map(([label, ratio]) => (
                  <div key={label as string}
                    onClick={() => {
                      if (side === 'sell') {
                        const holdingQty = portfolio?.holdings.find(h => h.stock_code === code)?.quantity ?? 0;
                        setQty(Math.max(1, Math.floor(holdingQty * (ratio as number))));
                      } else {
                        const bal = portfolio?.balance ?? 0;
                        const maxQty = Math.floor(bal / effectivePrice);
                        setQty(Math.max(1, Math.floor(maxQty * (ratio as number))));
                      }
                    }}
                    style={{ flex: 1, textAlign: 'center', padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: theme.panel2, border: `1px solid ${theme.border}`, color: theme.textMuted }}
                  >{label}</div>
                ))}
              </div>
            </div>

            {/* 총 주문 금액 */}
            <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: theme.textMuted }}>총 주문 금액</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{total.toLocaleString()}원</span>
            </div>

            {/* 주문 확정 버튼 */}
            <div
              onClick={() => !ordering && setConfirmOrder({ side, price: priceNum, qty, total: priceNum * qty })}
              style={{
                textAlign: 'center', padding: '11px 0', borderRadius: 8,
                background: side === 'buy' ? theme.up : theme.down,
                color: theme.bg, fontWeight: 700, fontSize: 14,
                cursor: ordering ? 'not-allowed' : 'pointer',
                opacity: ordering ? 0.6 : 1,
              }}
            >
              {side === 'buy' ? '매수하기' : '매도하기'}
            </div>
          </div>
        )}
      </div>

      {/* 호가 크게 보기 */}
      {orderbookExpanded && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setOrderbookExpanded(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 420, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 48px)',
            background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 16, padding: 20,
            boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StockLogo name={stock.name} code={stock.code} size={28} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{stock.name} 호가</div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>현재가 {priceNum.toLocaleString()}원 · 호가를 누르면 지정가로 입력</div>
              </div>
              <div
                onClick={() => setOrderbookExpanded(false)}
                style={{
                  marginLeft: 'auto', width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: theme.textMuted, fontSize: 13,
                }}
              >✕</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: theme.textMuted, padding: '0 10px 6px', borderBottom: `1px solid ${theme.border}` }}>
              <span>호가</span><span>잔량</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
              {renderOrderbook(10, true)}
            </div>
          </div>
        </div>
      )}

      {/* 주문 확인 오버레이 */}
      {confirmOrder && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setConfirmOrder(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 320, background: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: 16, padding: '24px 20px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, textAlign: 'center' }}>
              주문 확인
            </div>

            <div style={{
              background: theme.panel2, border: `1px solid ${theme.border}`,
              borderRadius: 10, padding: 14,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <StockLogo name={stock.name} code={stock.code} size={32} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{stock.name}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>{stock.code}</div>
                </div>
                <div style={{
                  marginLeft: 'auto', fontSize: 12, fontWeight: 700,
                  color: confirmOrder.side === 'buy' ? theme.up : theme.down,
                  border: `1px solid ${confirmOrder.side === 'buy' ? theme.up : theme.down}`,
                  borderRadius: 6, padding: '3px 10px',
                }}>
                  {confirmOrder.side === 'buy' ? '매수' : '매도'}
                </div>
              </div>

              <div style={{ height: 1, background: theme.border }} />

              {[
                ['주문 유형', orderType === 'limit' ? '지정가' : '시장가'],
                ['가격', `${confirmOrder.price.toLocaleString()}원`],
                ['수량', `${confirmOrder.qty.toLocaleString()}주`],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: theme.textMuted }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{value}</span>
                </div>
              ))}

              <div style={{ height: 1, background: theme.border }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ fontWeight: 700 }}>총 주문 금액</span>
                <span style={{ fontWeight: 800 }}>{confirmOrder.total.toLocaleString()}원</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div
                onClick={() => setConfirmOrder(null)}
                style={{
                  flex: 1, textAlign: 'center', padding: '11px 0', borderRadius: 8,
                  border: `1px solid ${theme.border}`, fontSize: 13, fontWeight: 600,
                  color: theme.textMuted, cursor: 'pointer',
                }}
              >취소</div>
              <div
                onClick={async () => {
                  const { side: s } = confirmOrder;
                  setConfirmOrder(null);
                  await handleOrder(s);
                }}
                style={{
                  flex: 1, textAlign: 'center', padding: '11px 0', borderRadius: 8,
                  background: confirmOrder.side === 'buy' ? theme.up : theme.down,
                  color: theme.bg, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >{confirmOrder.side === 'buy' ? '매수 확인' : '매도 확인'}</div>
            </div>
          </div>
        </div>
      )}

      {/* 관심 종목 추가 후 급등락 알림 여부 */}
      {askAlert && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => answerAlert(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 340, background: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: 16, padding: '24px 20px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
              <StockLogo name={stock.name} code={stock.code} size={44} />
              <div style={{ fontSize: 16, fontWeight: 800 }}>관심 종목에 추가했어요</div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                <b>{stock.name}</b> 주가가 <b>5% 이상</b> 오르거나 내리면<br />알려드릴까요?
              </div>
              <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>
                전일 종가 대비 5%, 10%, 15%… 를 넘을 때마다<br />오른쪽 위 알림에 표시돼요. 회원 설정에서 끌 수 있어요.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div
                onClick={() => answerAlert(false)}
                style={{
                  flex: 1, textAlign: 'center', padding: '11px 0', borderRadius: 8,
                  border: `1px solid ${theme.border}`, fontSize: 13, fontWeight: 600,
                  color: theme.textMuted, cursor: 'pointer',
                }}
              >괜찮아요</div>
              <div
                onClick={() => answerAlert(true)}
                style={{
                  flex: 1, textAlign: 'center', padding: '11px 0', borderRadius: 8,
                  background: theme.ai, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >알림 받기</div>
            </div>
          </div>
        </div>
      )}

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

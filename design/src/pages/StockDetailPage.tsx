import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { stocks, aiRecs, stockAiInsights } from '../data/mockData';
import StockLogo from '../components/StockLogo';
import { createOrder, fetchStockByCode, fetchStockCandles, fetchStockNews, fetchStockOrderbook, apiGet } from '../lib/api';
import type { ApiCandle, ApiNewsItem, ApiOrderbook } from '../lib/api';
import { timeAgo } from '../lib/time';
import CandleChart from '../components/CandleChart';
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';

const periods = ['1일', '1주', '1개월', '1년'] as const;

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
  const [period, setPeriod] = useState<(typeof periods)[number]>('1일');
  const [liked, setLiked] = useState(false);
  const [alerted, setAlerted] = useState(false);
  const [mainTab, setMainTab] = useState<'chart' | 'info' | 'news' | 'community'>('chart');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [rightTab, setRightTab] = useState<'insight' | 'portfolio'>('insight');
  const [orderHistory, setOrderHistory] = useState<{ side: 'buy' | 'sell'; type: 'limit' | 'market'; price: number; qty: number; total: number; time: string }[]>([]);
  const [floatPos, setFloatPos] = useState({ x: 0, y: 0 });
  const [floatMinimized, setFloatMinimized] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [stockId, setStockId] = useState<number | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [sellWarn, setSellWarn] = useState(false);
  const [confirmOrder, setConfirmOrder] = useState<{ side: 'buy' | 'sell'; price: number; qty: number; total: number } | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [liveChangeRate, setLiveChangeRate] = useState<number | null>(null);
  const [candles, setCandles] = useState<CandlestickData<UTCTimestamp>[]>([]);
  const [orderbook, setOrderbook] = useState<ApiOrderbook | null>(null);
  const [orderbookStatus, setOrderbookStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [news, setNews] = useState<ApiNewsItem[]>([]);
  const [newsStatus, setNewsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [stockInfo, setStockInfo] = useState<{
    english_name: string | null; isin_code: string | null; market: string | null;
    is_common_share: boolean | null; status: string | null; list_date: string | null;
    shares_outstanding: number | null; nxt_supported: boolean | null; trading_suspended: boolean | null;
  } | null>(null);
  const [stockInfoStatus, setStockInfoStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setFloatPos({ x: window.innerWidth - 316, y: window.innerHeight - 540 });
  }, []);

  const loadPortfolio = useCallback(() => {
    if (!isAuthenticated) return;
    apiGet<PortfolioData>('/portfolio').then(res => setPortfolio(res.data)).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => { loadPortfolio(); }, [loadPortfolio]);

  useEffect(() => {
    if (code) {
      fetchStockByCode(code).then(s => {
        if (s) {
          setStockId(s.id);
          if (s.current_price) setLivePrice(s.current_price);
          if (s.change_rate !== null) setLiveChangeRate(s.change_rate);
        }
      });
    }
  }, [code]);

  const periodToParams: Record<string, { interval: '1m' | '1d'; count: number }> = {
    '1일': { interval: '1m', count: 200 },
    '1주': { interval: '1d', count: 5 },
    '1개월': { interval: '1d', count: 22 },
    '1년': { interval: '1d', count: 200 },
  };

  useEffect(() => {
    if (stockId === null) return;
    const { interval, count } = periodToParams[period];
    fetchStockCandles(stockId, interval, count).then(raw => {
      setCandles(raw.map((c: ApiCandle) => ({
        time: (interval === '1m' ? Math.floor(new Date(c.timestamp).getTime() / 1000) : c.timestamp.slice(0, 10)) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })));
    }).catch(() => setCandles([]));
  }, [stockId, period]);

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

  // AI 추천 자동 전환
  const [activeRec, setActiveRec] = useState(0);
  const [showRec, setShowRec] = useState(true);
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveRec(prev => (prev + 1) % aiRecs.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const stock = stocks.find(s => s.code === code) ?? stocks[0];
  const mockPrice = parseInt(stock.price.replace(/[^0-9]/g, ''), 10);
  const priceNum = livePrice ?? mockPrice;
  const changeRate = liveChangeRate !== null ? liveChangeRate * 100 : stock.changePct;

  // 지정가 초기값 설정
  useEffect(() => { setInputPrice(priceNum); }, [priceNum]);

  const effectivePrice = orderType === 'market' ? priceNum : inputPrice;
  const total = effectivePrice * qty;

  const rec = aiRecs[activeRec];
  const recStock = stocks.find(s => s.name === rec.stockName) || stocks[0];
  const recChangeLabel = (recStock.changePct >= 0 ? '▲' : '▼') + Math.abs(recStock.changePct).toFixed(1) + '%';

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
          <div style={{ fontSize: 14, fontWeight: 700, color: changeRate >= 0 ? theme.up : theme.down }}>
            {(() => {
              const changeWon = Math.round(priceNum * changeRate / (100 + changeRate));
              const sign = changeRate >= 0 ? '+' : '';
              return `어제보다 ${sign}${changeWon.toLocaleString()}원 (${Math.abs(changeRate).toFixed(2)}%)`;
            })()}
          </div>
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
              {candles.length > 0 ? (
                <CandleChart data={candles} theme={theme} />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted, fontSize: 13 }}>
                  차트 데이터를 불러오는 중...
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
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>호가</div>
              {(() => {
                if (!orderbook) {
                  return (
                    <div style={{ fontSize: 12, color: theme.textMuted, padding: '20px 0', textAlign: 'center' }}>
                      {orderbookStatus === 'error' ? '호가를 불러오지 못했습니다' : '호가를 불러오는 중...'}
                    </div>
                  );
                }
                // 위에서부터 높은 가격순: 매도호가(현재가에서 먼 것부터) → 매수호가(현재가에 가까운 것부터)
                const asks = orderbook.asks.slice(0, ORDERBOOK_LEVELS).reverse();
                const bids = orderbook.bids.slice(0, ORDERBOOK_LEVELS);
                if (asks.length === 0 && bids.length === 0) {
                  return <div style={{ fontSize: 12, color: theme.textMuted, padding: '20px 0', textAlign: 'center' }}>표시할 호가가 없습니다</div>;
                }
                const maxVolume = Math.max(1, ...asks.map(l => l.volume), ...bids.map(l => l.volume));
                const row = (l: { price: number; volume: number }, side: 'ask' | 'bid') => {
                  const color = side === 'ask' ? theme.down : theme.up;
                  return (
                    <div
                      key={`${side}-${l.price}`}
                      onClick={() => { setOrderType('limit'); setInputPrice(l.price); }}
                      style={{
                        position: 'relative', display: 'flex', justifyContent: 'space-between',
                        fontSize: 12, padding: '3px 6px', borderRadius: 4, cursor: 'pointer', overflow: 'hidden',
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
              })()}
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
                display: 'flex', flexDirection: 'column', gap: 2,
                padding: '10px 0', borderBottom: `1px solid ${theme.border}`,
                color: 'inherit', textDecoration: 'none',
              }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>{n.source ?? ''} · {timeAgo(n.published_at)}</div>
              </a>
            ))}
          </div>
        )}

        {/* 커뮤니티 탭 */}
        {mainTab === 'community' && (
          <div style={{
            background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 12, padding: 24, minHeight: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme.textMuted, fontSize: 13,
          }}>
            커뮤니티 준비 중
          </div>
        )}
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
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>{stock.aiReason}</div>
            </div>

            {/* AI 종합 게이지 */}
            {(() => {
              const insights = stockAiInsights.filter(i => i.stockName === stock.name);
              if (insights.length === 0) return null;
              const buyCount = insights.filter(i => i.signal === '매수').length;
              const neutralCount = insights.filter(i => i.signal === '중립').length;
              const sellCount = insights.filter(i => i.signal === '매도').length;
              const total = insights.length;
              // -1(매도) ~ +1(매수) 평균 스코어
              const score = (buyCount - sellCount) / total;
              // 0%=매도, 50%=중립, 100%=매수
              const pct = ((score + 1) / 2) * 100;
              const gaugeColor = score > 0.2 ? theme.up : score < -0.2 ? theme.down : theme.textMuted;
              const gaugeLabel = score > 0.2 ? '매수 우세' : score < -0.2 ? '매도 우세' : '중립';

              return (
                <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>AI 종합 의견</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: gaugeColor }}>{gaugeLabel}</div>
                  </div>

                  {/* 게이지 바 */}
                  <div style={{ position: 'relative' }}>
                    {/* 배경 그라디언트 바 */}
                    <div style={{
                      height: 8, borderRadius: 99,
                      background: `linear-gradient(to right, ${theme.down}, ${theme.textMuted} 50%, ${theme.up})`,
                      opacity: 0.35,
                    }} />
                    {/* 포인터 */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: `${pct}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 16, height: 16,
                      borderRadius: '50%',
                      background: gaugeColor,
                      border: `3px solid ${theme.panel2}`,
                      boxShadow: `0 0 0 2px ${gaugeColor}`,
                      transition: 'left 0.4s ease',
                    }} />
                  </div>

                  {/* 라벨 + 카운트 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600 }}>
                    <span style={{ color: theme.down }}>매도 {sellCount}</span>
                    <span style={{ color: theme.textMuted }}>중립 {neutralCount}</span>
                    <span style={{ color: theme.up }}>매수 {buyCount}</span>
                  </div>
                </div>
              );
            })()}

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
            <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>유사 종목</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {stock.similar.map(name => (
                <div key={name} style={{ padding: '5px 10px', borderRadius: 20, border: `1px solid ${theme.border}`, fontSize: 12, color: theme.textMuted, cursor: 'pointer' }}
                  onClick={() => { const s = stocks.find(s => s.name === name); if (s) navigate(`/stock/${s.code}`); }}>
                  {name}
                </div>
              ))}
            </div>
          </>}

          {/* 내 모의매매 탭 */}
          {rightTab === 'portfolio' && <>
            {/* AI 추천 카드 */}
            {showRec && (
              <div
                onClick={() => navigate(`/stock/${recStock.code}`)}
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
                    <StockLogo name={recStock.name} code={recStock.code} size={20} />
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{rec.stockName}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: recStock.changePct >= 0 ? '#fca5a5' : '#93c5fd' }}>{recChangeLabel}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, wordBreak: 'keep-all' }}>{rec.reason}</div>
                </div>
              </div>
            )}

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
                      <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>{h.avg_price.toLocaleString()}원</span>
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

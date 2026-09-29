import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { orderbook } from '../data/mockData';
import StockLogo from '../components/StockLogo';
import {
  fetchStockByCode, fetchStockNews, fetchStockCandles,
  createOrder, getAccount,
  type ApiStock, type ApiNewsItem, type AccountInfo,
} from '../lib/api';
import { timeAgo } from '../lib/time';
import CandleChart from '../components/CandleChart';
import type { UTCTimestamp } from 'lightweight-charts';

const periods = ['1일', '1주', '1개월', '1년'] as const;

const PERIOD_PARAMS: Record<(typeof periods)[number], { interval: '1m' | '1d'; count: number }> = {
  '1일': { interval: '1m', count: 200 },
  '1주': { interval: '1d', count: 5 },
  '1개월': { interval: '1d', count: 22 },
  '1년': { interval: '1d', count: 200 },
};

export default function StockDetailPage() {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qty, setQty] = useState(1);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [period, setPeriod] = useState<(typeof periods)[number]>('1일');

  const [stock, setStock] = useState<ApiStock | null>(null);
  const [news, setNews] = useState<ApiNewsItem[]>([]);
  const [candles, setCandles] = useState<{ time: UTCTimestamp | string; open: number; high: number; low: number; close: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setNotFound(false);
    fetchStockByCode(code)
      .then(async found => {
        if (!found) {
          setNotFound(true);
          return;
        }
        setStock(found);
        try {
          setNews(await fetchStockNews(found.id));
        } catch {
          setNews([]);
        }
      })
      .finally(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    if (!stock) return;
    const { interval, count } = PERIOD_PARAMS[period];
    fetchStockCandles(stock.id, interval, count)
      .then(raw => {
        setCandles(
          raw.map(c => ({
            time: interval === '1d'
              ? c.timestamp.slice(0, 10)
              : (Math.floor(new Date(c.timestamp).getTime() / 1000) as UTCTimestamp),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
      })
      .catch(() => setCandles([]));
  }, [stock, period]);

  useEffect(() => {
    if (isAuthenticated) {
      getAccount().then(res => setAccount(res.data)).catch(() => {});
    }
  }, [isAuthenticated]);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2600);
  };

  const handleOrder = async () => {
    if (!isAuthenticated) {
      showToast('로그인이 필요합니다', false);
      return;
    }
    if (!stock) {
      showToast('종목 정보를 불러오는 중입니다', false);
      return;
    }
    setOrderLoading(true);
    try {
      const res = await createOrder({
        stock_id: stock.id,
        order_type: side === 'buy' ? 'BUY' : 'SELL',
        quantity: qty,
        price: stock.current_price ?? 0,
      });
      showToast(
        `${side === 'buy' ? '매수' : '매도'} 체결: ${res.data.stock_name} ${qty}주 · ${total.toLocaleString()}원`,
        true,
      );
      getAccount().then(r => setAccount(r.data)).catch(() => {});
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '주문 실패', false);
    } finally {
      setOrderLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: theme.textMuted }}>불러오는 중...</div>;
  }

  if (notFound || !stock) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ color: theme.down }}>종목 정보를 찾을 수 없습니다.</div>
        <button onClick={() => navigate('/')} style={{ alignSelf: 'flex-start', color: theme.ai, background: 'none', border: 'none', cursor: 'pointer' }}>
          ← 랭킹으로
        </button>
      </div>
    );
  }

  const changePct = stock.change_rate != null ? stock.change_rate * 100 : 0;
  const changeColor = changePct >= 0 ? theme.up : theme.down;
  const changeLabel = (changePct >= 0 ? '▲' : '▼') + Math.abs(changePct).toFixed(1) + '%';
  const priceLabel = stock.current_price != null ? `${stock.current_price.toLocaleString()}원` : '-';
  const total = (stock.current_price ?? 0) * qty;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* 메인 콘텐츠 */}
      <div style={{
        flex: 1, minWidth: 0, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            alignSelf: 'flex-start',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 8, border: `1px solid ${theme.border}`,
            fontSize: 13, fontWeight: 600, color: theme.textMuted,
            cursor: 'pointer', background: 'transparent', fontFamily: 'inherit',
          }}
        >
          ← 랭킹으로
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StockLogo name={stock.name} size={48} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{stock.name}</div>
            <div style={{ fontSize: 13, color: theme.textMuted }}>{stock.code}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.01em' }}>{priceLabel}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: changeColor }}>{changeLabel}</div>
          <div style={{ fontSize: 12, color: theme.textMuted }}>거래량 -</div>
        </div>

        {/* 차트 */}
        <div style={{
          background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: 12, height: 260,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: `1px solid ${theme.border}` }}>
            {periods.map(p => (
              <div
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  fontSize: 12, fontWeight: 600,
                  padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                  background: period === p ? theme.ai : 'transparent',
                  color: period === p ? theme.bg : theme.textMuted,
                }}
              >
                {p}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {candles.length > 0 ? (
              <CandleChart data={candles} theme={theme} />
            ) : (
              <div style={{
                height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: theme.textMuted, fontSize: 13,
              }}>
                차트 데이터를 불러오는 중...
              </div>
            )}
          </div>
        </div>

        {/* 주문 + 호가 */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{
            flex: 1, background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 12, padding: 16,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>모의 매수 / 매도</div>
              {account && (
                <div style={{ fontSize: 11, color: theme.textMuted }}>
                  잔고 <span style={{ color: theme.text, fontWeight: 600 }}>{account.balance.toLocaleString()}원</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['buy', 'sell'] as const).map(s => (
                <div
                  key={s}
                  onClick={() => setSide(s)}
                  style={{
                    flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 8,
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    background: side === s ? (s === 'buy' ? theme.up : theme.down) : 'transparent',
                    color: side === s ? theme.bg : (s === 'buy' ? theme.up : theme.down),
                    border: `1px solid ${s === 'buy' ? theme.up : theme.down}`,
                  }}
                >
                  {s === 'buy' ? '매수' : '매도'}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: theme.textMuted }}>
              <span>수량</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  style={{
                    width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: theme.text,
                  }}
                >-</div>
                <span style={{ color: theme.text, fontWeight: 600, minWidth: 32, textAlign: 'center' }}>{qty}주</span>
                <div
                  onClick={() => setQty(q => q + 1)}
                  style={{
                    width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: theme.text,
                  }}
                >+</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: theme.textMuted }}>
              <span>주문금액</span>
              <span style={{ color: theme.text, fontWeight: 600 }}>{total.toLocaleString()}원</span>
            </div>
            <div
              onClick={!orderLoading ? handleOrder : undefined}
              style={{
                textAlign: 'center', padding: '10px 0', borderRadius: 8,
                background: orderLoading ? theme.border : (side === 'buy' ? theme.up : theme.down),
                color: theme.bg, fontWeight: 700, fontSize: 13,
                cursor: orderLoading ? 'not-allowed' : 'pointer',
                opacity: orderLoading ? 0.7 : 1,
              }}
            >
              {orderLoading ? '처리 중...' : `${side === 'buy' ? '매수' : '매도'} 주문 실행`}
            </div>
          </div>

          <div style={{
            flex: 1, background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 12, padding: 16,
            display: 'flex', flexDirection: 'column', gap: 6,
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
          borderRadius: 12, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>최근 뉴스</div>
          {news.length === 0 && (
            <div style={{ fontSize: 12, color: theme.textMuted, padding: '8px 0' }}>관련 뉴스가 없습니다.</div>
          )}
          {news.map(n => (
            <a
              key={n.id}
              href={n.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', flexDirection: 'column', gap: 2,
                padding: '10px 0', borderBottom: `1px solid ${theme.border}`,
                color: 'inherit', textDecoration: 'none',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
              <div style={{ fontSize: 11, color: theme.textMuted }}>{n.source ?? '출처 미상'} · {timeAgo(n.published_at)}</div>
            </a>
          ))}
        </div>
      </div>

      {/* AI 인사이트 패널 */}
      <div style={{
        width: 300, flexShrink: 0,
        borderLeft: `1px solid ${theme.border}`,
        background: theme.panel,
        padding: 20,
        display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: theme.ai }}>
          <span>AI 인사이트</span>
        </div>

        <div style={{
          background: theme.panel2, border: `1px solid ${theme.border}`,
          borderRadius: 10, padding: 14,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>뉴스 기반 등락 이유</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: theme.textMuted }}>
            AI 분석 기능은 아직 준비 중입니다.
          </div>
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? theme.up : theme.down,
          borderRadius: 10, padding: '12px 20px', fontSize: 13, fontWeight: 600,
          color: theme.bg,
          boxShadow: '0 8px 24px rgba(0,0,0,.3)', zIndex: 50,
          whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

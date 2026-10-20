import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import StockLogo from '../components/StockLogo';
import AssetTrendChart from '../components/AssetTrendChart';
import HoldingsDonut from '../components/HoldingsDonut';
import { apiGet, fetchWatchlist, getAssetHistory, removeWatchlist, setWatchAlert } from '../lib/api';
import type { ApiAssetHistory, ApiWatchlist } from '../lib/api';
import { usePolling, PORTFOLIO_POLL_MS } from '../lib/usePolling';
import { useViewport } from '../lib/useViewport';

const TREND_PERIODS = [['1개월', 30], ['3개월', 90], ['1년', 365]] as const;

interface HoldingItem {
  stock_id: number;
  stock_name: string;
  stock_code: string;
  quantity: number;
  avg_price: number;
  current_price: number;
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

interface HistoryItem {
  id: number;
  stock_name: string;
  stock_code: string;
  order_type: string;
  quantity: number;
  price: number;
  total_amount: number;
  ordered_at: string;
  // 매도에만 있다: 그때 평균 매수가 대비 실현 손익
  avg_buy_price: number | null;
  realized_profit: number | null;
  realized_profit_rate: number | null;
}

const HISTORY_COLUMNS = '110px 50px 1fr 60px 100px 110px 150px';

export default function PortfolioPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { isMobile } = useViewport();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [watchlist, setWatchlist] = useState<ApiWatchlist | null>(null);
  const [trendDays, setTrendDays] = useState<number>(90);
  const [assetHistory, setAssetHistory] = useState<ApiAssetHistory | null>(null);
  const [assetHistoryStatus, setAssetHistoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = () => {
    Promise.all([
      apiGet<PortfolioData>('/portfolio'),
      apiGet<HistoryItem[]>('/portfolio/history'),
    ]).then(([pRes, hRes]) => {
      setPortfolio(pRes.data);
      setHistory(hRes.data);
      setStatus('ready');
    }).catch(() => {
      // 이미 받아 둔 값이 있으면 일시적인 실패로 화면을 0원으로 바꾸지 않는다
      setStatus(prev => (prev === 'ready' ? prev : 'error'));
    });
    fetchWatchlist().then(res => setWatchlist(res.data)).catch(() => {});
  };
  usePolling(load, PORTFOLIO_POLL_MS);

  useEffect(() => {
    let cancelled = false;
    setAssetHistoryStatus('loading');
    getAssetHistory(trendDays)
      .then(res => {
        if (cancelled) return;
        setAssetHistory(res.data);
        setAssetHistoryStatus('ready');
      })
      .catch(() => { if (!cancelled) setAssetHistoryStatus('error'); });
    return () => { cancelled = true; };
  }, [trendDays]);

  const toggleWatchAlert = (stockId: number, enabled: boolean) => {
    setWatchlist(prev => prev && { ...prev, items: prev.items.map(w => w.stock_id === stockId ? { ...w, alert_enabled: enabled } : w) });
    setWatchAlert(stockId, enabled).catch(() => {
      setWatchlist(prev => prev && { ...prev, items: prev.items.map(w => w.stock_id === stockId ? { ...w, alert_enabled: !enabled } : w) });
    });
  };

  const unwatch = (stockId: number) => {
    const before = watchlist;
    setWatchlist(prev => prev && { ...prev, items: prev.items.filter(w => w.stock_id !== stockId) });
    removeWatchlist(stockId).catch(() => setWatchlist(before));
  };

  if (status === 'loading') {
    return (
      <div style={{ padding: 24, color: '#888', fontSize: 14 }}>불러오는 중...</div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 14, color: theme.textMuted }}>포트폴리오를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>
        <div
          onClick={() => { setStatus('loading'); load(); }}
          style={{
            fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
            background: theme.ai, color: theme.aiText,
          }}
        >다시 시도</div>
      </div>
    );
  }

  const totalAsset = (portfolio?.balance ?? 0) + (portfolio?.total_eval_amount ?? 0);
  const totalProfit = portfolio?.total_profit_loss ?? 0;
  const profitPct = portfolio?.total_profit_loss_rate ?? 0;
  const profitColor = totalProfit >= 0 ? theme.up : theme.down;

  return (
    <div style={{ padding: isMobile ? 16 : 24, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', height: '100%' }}>
      <div style={{ fontSize: 18, fontWeight: 800 }}>내 포트폴리오</div>

      {/* 자산 요약 (좁으면 두 줄로 내려간다) */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { label: '총 평가자산', value: totalAsset.toLocaleString() + '원', color: undefined },
          {
            label: '총 수익',
            value: (totalProfit >= 0 ? '+' : '') + totalProfit.toLocaleString() + '원 (' + profitPct.toFixed(2) + '%)',
            color: profitColor,
          },
          { label: '가상현금', value: (portfolio?.balance ?? 0).toLocaleString() + '원', color: undefined },
          { label: '평가금액', value: (portfolio?.total_eval_amount ?? 0).toLocaleString() + '원', color: undefined },
        ].map(card => (
          <div key={card.label} style={{
            flex: '1 1 150px', minWidth: 0, background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 12, padding: isMobile ? '14px 16px' : '16px 20px',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 600 }}>{card.label}</div>
            <div style={{
              fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
              color: card.color ?? theme.text,
            }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* 자산 추이 · 보유 비중 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{
          flex: '3 1 420px', minWidth: 0, background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>자산 추이</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {TREND_PERIODS.map(([label, days]) => (
                <div key={label} onClick={() => setTrendDays(days)} style={{
                  fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                  background: trendDays === days ? theme.ai : 'transparent',
                  color: trendDays === days ? theme.aiText : theme.textMuted,
                }}>{label}</div>
              ))}
            </div>
          </div>
          {assetHistory ? (
            <AssetTrendChart points={assetHistory.points} initialBalance={assetHistory.initial_balance} />
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: theme.textMuted }}>
              {assetHistoryStatus === 'error' ? '자산 추이를 불러오지 못했습니다' : '자산 추이를 불러오는 중...'}
            </div>
          )}
        </div>

        <div style={{
          flex: '2 1 340px', minWidth: 0, background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>보유 비중</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <HoldingsDonut holdings={portfolio?.holdings ?? []} />
          </div>
        </div>
      </div>

      {/* 보유 종목 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>보유 종목</div>
        <div style={{
          background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: 12, overflowX: 'auto', overflowY: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 110px 110px 90px', minWidth: 520,
            padding: '10px 16px', borderBottom: `1px solid ${theme.border}`,
            fontSize: 12, fontWeight: 700, color: theme.textMuted,
          }}>
            <span>종목명</span>
            <span style={{ textAlign: 'right' }}>보유수량</span>
            <span style={{ textAlign: 'right' }}>평균단가</span>
            <span style={{ textAlign: 'right' }}>평가금액</span>
            <span style={{ textAlign: 'right' }}>수익률</span>
          </div>
          {portfolio?.holdings.length === 0 && (
            <div style={{ padding: '20px 16px', fontSize: 13, color: theme.textMuted, textAlign: 'center' }}>
              보유 종목이 없습니다
            </div>
          )}
          {portfolio?.holdings.map(h => {
            const changeColor = h.profit_loss_rate >= 0 ? theme.up : theme.down;
            const changeLabel = (h.profit_loss_rate >= 0 ? '▲' : '▼') + Math.abs(h.profit_loss_rate).toFixed(2) + '%';
            return (
              <div key={h.stock_id} style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 110px 110px 90px', minWidth: 520,
                padding: '12px 16px', borderBottom: `1px solid ${theme.border}`,
                fontSize: 13, alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StockLogo name={h.stock_name} code={h.stock_code} size={28} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{h.stock_name}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted }}>{h.stock_code}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>{h.quantity}주</div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>{h.avg_price.toLocaleString()}원</div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>{h.eval_amount.toLocaleString()}원</div>
                <div style={{ textAlign: 'right', fontWeight: 700, color: changeColor }}>{changeLabel}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 관심 종목 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>관심 종목</div>
          {watchlist && !watchlist.price_alert_enabled && (
            <div style={{ fontSize: 12, color: theme.textMuted }}>회원 설정에서 급등락 알림이 꺼져 있어 알림이 오지 않아요</div>
          )}
        </div>
        <div style={{
          background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: 12, overflowX: 'auto', overflowY: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 110px 170px 70px 50px', minWidth: 560,
            padding: '10px 16px', borderBottom: `1px solid ${theme.border}`,
            fontSize: 12, fontWeight: 700, color: theme.textMuted,
          }}>
            <span>종목명</span>
            <span style={{ textAlign: 'right' }}>현재가</span>
            <span style={{ textAlign: 'right' }}>전일 대비</span>
            <span style={{ textAlign: 'center' }}>±5% 알림</span>
            <span />
          </div>
          {watchlist?.items.length === 0 && (
            <div style={{ padding: '20px 16px', fontSize: 13, color: theme.textMuted, textAlign: 'center' }}>
              관심 종목이 없습니다. 종목 상세에서 ♡를 눌러 추가해 보세요
            </div>
          )}
          {watchlist?.items.map(w => {
            const hasPrice = w.current_price !== null && w.change !== null && w.change_rate !== null;
            const changeColor = (w.change ?? 0) >= 0 ? theme.up : theme.down;
            const sign = (w.change ?? 0) >= 0 ? '+' : '-';
            return (
              <div key={w.stock_id} style={{
                display: 'grid', gridTemplateColumns: '1fr 110px 170px 70px 50px', minWidth: 560,
                padding: '12px 16px', borderBottom: `1px solid ${theme.border}`,
                fontSize: 13, alignItems: 'center',
              }}>
                <div onClick={() => navigate(`/stock/${w.stock_code}`)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <StockLogo name={w.stock_name} code={w.stock_code} size={28} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{w.stock_name}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted }}>{w.stock_code}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>{hasPrice ? `${w.current_price!.toLocaleString()}원` : '-'}</div>
                <div style={{ textAlign: 'right', fontWeight: 700, color: changeColor }}>
                  {hasPrice ? `${sign}${Math.abs(w.change!).toLocaleString()}원 (${Math.abs(w.change_rate!).toFixed(2)}%)` : '-'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div
                    onClick={() => toggleWatchAlert(w.stock_id, !w.alert_enabled)}
                    title={w.alert_enabled ? '알림 끄기' : '알림 켜기'}
                    style={{
                      width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: w.alert_enabled ? theme.aiSoft : 'transparent',
                      border: `1px solid ${w.alert_enabled ? theme.ai : theme.border}`,
                      color: w.alert_enabled ? theme.ai : theme.textMuted,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={w.alert_enabled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div
                    onClick={() => unwatch(w.stock_id)}
                    title="관심 종목에서 빼기"
                    style={{ cursor: 'pointer', color: '#ef4444', display: 'flex' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#ef4444" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 거래 내역 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>거래 내역</div>
          {(() => {
            const sells = history.filter(t => t.realized_profit !== null);
            if (sells.length === 0) return null;
            const total = sells.reduce((sum, t) => sum + t.realized_profit!, 0);
            return (
              <div style={{ fontSize: 12, color: theme.textMuted }}>
                실현 손익 합계{' '}
                <span style={{ fontWeight: 700, color: total >= 0 ? theme.up : theme.down }}>
                  {total >= 0 ? '+' : '-'}{Math.abs(total).toLocaleString()}원
                </span>
              </div>
            );
          })()}
        </div>
        <div style={{
          background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: 12, overflowX: 'auto', overflowY: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: HISTORY_COLUMNS, minWidth: 720,
            padding: '10px 16px', borderBottom: `1px solid ${theme.border}`,
            fontSize: 12, fontWeight: 700, color: theme.textMuted,
          }}>
            <span>날짜</span>
            <span>구분</span>
            <span>종목명</span>
            <span style={{ textAlign: 'right' }}>수량</span>
            <span style={{ textAlign: 'right' }}>단가</span>
            <span style={{ textAlign: 'right' }}>거래금액</span>
            <span style={{ textAlign: 'right' }}>실현 손익</span>
          </div>
          {history.length === 0 && (
            <div style={{ padding: '20px 16px', fontSize: 13, color: theme.textMuted, textAlign: 'center' }}>
              거래 내역이 없습니다
            </div>
          )}
          {history.map(t => {
            const date = new Date(t.ordered_at).toLocaleDateString('ko-KR', {
              year: '2-digit', month: '2-digit', day: '2-digit',
            });
            const isBuy = t.order_type === 'BUY';
            return (
              <div key={t.id} style={{
                display: 'grid', gridTemplateColumns: HISTORY_COLUMNS, minWidth: 720,
                padding: '11px 16px', borderBottom: `1px solid ${theme.border}`,
                fontSize: 13, alignItems: 'center',
              }}>
                <span style={{ color: theme.textMuted, fontSize: 12 }}>{date}</span>
                <span style={{ fontWeight: 700, fontSize: 12, color: isBuy ? theme.up : theme.down }}>
                  {isBuy ? '매수' : '매도'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <StockLogo name={t.stock_name} code={t.stock_code} size={22} />
                  <span style={{ fontWeight: 600 }}>{t.stock_name}</span>
                </div>
                <span style={{ textAlign: 'right' }}>{t.quantity}주</span>
                <span style={{ textAlign: 'right' }}>{t.price.toLocaleString()}원</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{t.total_amount.toLocaleString()}원</span>
                {t.realized_profit === null ? (
                  <span style={{ textAlign: 'right', color: theme.textMuted }}>-</span>
                ) : (
                  <span
                    title={`평균 매수가 ${t.avg_buy_price!.toLocaleString()}원`}
                    style={{ textAlign: 'right', fontWeight: 700, color: t.realized_profit >= 0 ? theme.up : theme.down }}
                  >
                    {t.realized_profit >= 0 ? '+' : '-'}{Math.abs(t.realized_profit).toLocaleString()}원 ({Math.abs(t.realized_profit_rate!).toFixed(2)}%)
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

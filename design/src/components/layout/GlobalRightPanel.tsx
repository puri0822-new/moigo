import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import StockLogo from '../StockLogo';
import AiRecCard from '../AiRecCard';
import { apiGet, fetchWatchlist } from '../../lib/api';
import type { ApiWatchItem } from '../../lib/api';
import { usePolling, PORTFOLIO_POLL_MS } from '../../lib/usePolling';

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

export default function GlobalRightPanel() {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [watchlist, setWatchlist] = useState<ApiWatchItem[]>([]);

  useEffect(() => {
    if (!isAuthenticated) { setPortfolio(null); setWatchlist([]); }
  }, [isAuthenticated]);

  usePolling(() => {
    apiGet<PortfolioData>('/portfolio').then(res => setPortfolio(res.data)).catch(() => {});
    fetchWatchlist().then(res => setWatchlist(res.data.items)).catch(() => {});
  }, PORTFOLIO_POLL_MS, isAuthenticated);


  return (
    <div style={{
      width: 300, flexShrink: 0,
      borderLeft: `1px solid ${theme.border}`,
      background: theme.panel,
      padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
      overflowY: 'auto',
    }}>
      {/* AI 추천 카드 (아직 결과가 나오지 않은 실제 추천) */}
      <AiRecCard />

      <div style={{ fontSize: 13, fontWeight: 700, color: theme.ai, background: theme.aiSoft, borderRadius: 8, padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.ai}` }}>
        ✦ 내 모의매매
      </div>

      {/* 총 평가자산 */}
      {isAuthenticated && portfolio ? (() => {
        const totalAsset = portfolio.balance + portfolio.total_eval_amount;
        const totalProfit = portfolio.total_profit_loss;
        const profitRate = portfolio.total_profit_loss_rate;
        const profitColor = totalProfit >= 0 ? theme.up : theme.down;
        return (
          <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>총 평가자산</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>{totalAsset.toLocaleString()}원</div>
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

      {/* 보유 종목 */}
      <CollapsibleSection title="보유 종목" storageKey="panel.holdings.hidden">
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
                <span style={{ fontSize: 11, fontWeight: 700, color: changeColor, flexShrink: 0 }}>{sign}{Math.abs(h.profit_loss).toLocaleString()}원 ({Math.abs(h.profit_loss_rate).toFixed(2)}%)</span>
              </div>
            </div>
          </div>
        );
      })}
      </CollapsibleSection>

      <div onClick={() => navigate('/portfolio')} style={{ textAlign: 'center', padding: '9px 0', borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 12, fontWeight: 600, color: theme.textMuted, cursor: 'pointer', marginTop: 4 }}>
        전체 포트폴리오 보기
      </div>

      {/* 관심 종목 (종목 상세의 하트) */}
      {isAuthenticated && (
        <CollapsibleSection title="관심 종목" storageKey="panel.watchlist.hidden" style={{ marginTop: 8 }}>
          {watchlist.length === 0 && (
            <div style={{ fontSize: 12, color: theme.textMuted, textAlign: 'center', padding: '12px 0', lineHeight: 1.6 }}>
              종목 상세에서 ♡를 누르면<br />여기에 모아 보여드려요
            </div>
          )}
          {watchlist.map(w => {
            const hasPrice = w.current_price !== null && w.change !== null && w.change_rate !== null;
            const changeColor = (w.change ?? 0) >= 0 ? theme.up : theme.down;
            const sign = (w.change ?? 0) >= 0 ? '+' : '-';
            return (
              <div key={w.stock_id} onClick={() => navigate(`/stock/${w.stock_code}`)} style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <StockLogo name={w.stock_name} code={w.stock_code} size={30} />
                {/* 종목명은 아이콘 높이 가운데, 가격과 등락은 오른쪽에 위아래로 */}
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.stock_name}</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{hasPrice ? `${w.current_price!.toLocaleString()}원` : '-'}</span>
                  {hasPrice && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: changeColor }}>{sign}{Math.abs(w.change!).toLocaleString()}원 ({Math.abs(w.change_rate!).toFixed(2)}%)</span>
                  )}
                </div>
              </div>
            );
          })}
        </CollapsibleSection>
      )}
    </div>
  );
}

/** 제목 오른쪽 "숨기기/보이기" 버튼으로 아래 목록을 접었다 편다. 접은 상태는 이 브라우저에만 기억한다 */
function CollapsibleSection({ title, storageKey, style, children }: {
  title: string; storageKey: string; style?: React.CSSProperties; children: ReactNode;
}) {
  const { theme } = useTheme();
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* 저장 못 해도 화면은 동작 */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>{title}</span>
        <span
          onClick={toggle}
          style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: theme.textMuted, cursor: 'pointer', padding: '2px 4px' }}
        >
          {hidden ? '보이기' : '숨기기'}
        </span>
      </div>
      {/* 높이를 0fr ↔ 1fr로 바꿔 목록 높이에 상관없이 부드럽게 말려 올라가게 한다 */}
      <div style={{
        display: 'grid', gridTemplateRows: hidden ? '0fr' : '1fr',
        transition: 'grid-template-rows 0.25s ease',
      }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 14 }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

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
import { FS, FW, RADIUS } from '../../lib/tokens';
import Pressable from '../Pressable';

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
  // 실패를 "보유·관심 종목 없음"으로 오해하지 않게 따로 기록한다
  const [portfolioFailed, setPortfolioFailed] = useState(false);
  const [watchlistLoaded, setWatchlistLoaded] = useState(false);
  const [watchlistFailed, setWatchlistFailed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { setPortfolio(null); setWatchlist([]); setWatchlistLoaded(false); setPortfolioFailed(false); setWatchlistFailed(false); }
  }, [isAuthenticated]);

  usePolling(() => {
    apiGet<PortfolioData>('/portfolio')
      .then(res => { setPortfolio(res.data); setPortfolioFailed(false); })
      .catch(() => setPortfolioFailed(true));
    fetchWatchlist()
      .then(res => { setWatchlist(res.data.items); setWatchlistLoaded(true); setWatchlistFailed(false); })
      .catch(() => setWatchlistFailed(true));
  }, PORTFOLIO_POLL_MS, isAuthenticated);


  return (
    <div style={{
      width: 300, flexShrink: 0,
      borderLeft: `1px solid ${theme.border}`,
      background: theme.panel,
      // 본문(24)과 윗선, 헤더(좌우 24)와 오른쪽 끝을 맞춘다
      padding: 24,
      display: 'flex', flexDirection: 'column', gap: 16,
      overflowY: 'auto',
    }}>
      {/* AI 추천 카드 (아직 결과가 나오지 않은 실제 추천) */}
      <AiRecCard />

      <div style={{ fontSize: FS.body, fontWeight: FW.semibold, color: theme.aiFg, background: theme.aiSoft, borderRadius: RADIUS.md, padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${theme.ai}` }}>
        ✦ 내 모의매매
      </div>

      {/* 총 평가자산 */}
      {isAuthenticated && portfolio ? (() => {
        const totalAsset = portfolio.balance + portfolio.total_eval_amount;
        const totalProfit = portfolio.total_profit_loss;
        const profitRate = portfolio.total_profit_loss_rate;
        const profitColor = totalProfit >= 0 ? theme.up : theme.down;
        return (
          <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: FS.caption, fontWeight: FW.semibold, color: theme.textMuted }}>총 평가자산</div>
            <div style={{ fontSize: FS.heading, fontWeight: FW.bold, letterSpacing: '-0.01em' }}>{totalAsset.toLocaleString()}원</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS.caption }}>
              <span style={{ color: theme.textMuted }}>수익</span>
              <span style={{ fontWeight: FW.semibold, color: profitColor }}>{totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()}원 ({profitRate.toFixed(2)}%)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS.caption }}>
              <span style={{ color: theme.textMuted }}>가상현금</span>
              <span style={{ fontWeight: FW.medium }}>{portfolio.balance.toLocaleString()}원</span>
            </div>
          </div>
        );
      })() : (
        <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, padding: 16, fontSize: FS.body, color: theme.textMuted, textAlign: 'center' }}>
          로그인 후 확인 가능
        </div>
      )}

      {/* 보유 종목 */}
      <CollapsibleSection title="보유 종목" storageKey="panel.holdings.hidden">
      {!isAuthenticated && (
        <div style={{ fontSize: FS.caption, color: theme.textMuted, textAlign: 'center', padding: '12px 0' }}>로그인 후 확인 가능</div>
      )}
      {isAuthenticated && !portfolio && portfolioFailed && (
        <div role="alert" style={{ fontSize: FS.caption, color: theme.error, textAlign: 'center', padding: '12px 0', lineHeight: 1.6 }}>⚠ 보유 종목을 불러오지 못했어요<br />잠시 후 자동으로 다시 시도해요</div>
      )}
      {isAuthenticated && portfolio?.holdings.length === 0 && (
        <div style={{ fontSize: FS.caption, color: theme.textMuted, textAlign: 'center', padding: '12px 0' }}>보유 종목 없음</div>
      )}
      {portfolio?.holdings.map(h => {
        const changeColor = h.profit_loss_rate >= 0 ? theme.up : theme.down;
        const sign = h.profit_loss >= 0 ? '+' : '-';
        return (
          <Pressable key={h.stock_id} onClick={() => navigate(`/stock/${h.stock_code}`)} style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, padding: '12px 12px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <StockLogo name={h.stock_name} code={h.stock_code} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: FS.body, fontWeight: FW.semibold, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.stock_name}</span>
                <span style={{ fontSize: FS.caption, fontWeight: FW.semibold, flexShrink: 0, marginLeft: 8 }}>{h.eval_amount.toLocaleString()}원</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 }}>
                <span style={{ fontSize: FS.caption, color: theme.textMuted }}>{h.quantity}주</span>
                <span style={{ fontSize: FS.caption, fontWeight: FW.semibold, color: changeColor, flexShrink: 0 }}>{sign}{Math.abs(h.profit_loss).toLocaleString()}원 ({Math.abs(h.profit_loss_rate).toFixed(2)}%)</span>
              </div>
            </div>
          </Pressable>
        );
      })}
      </CollapsibleSection>

      <Pressable onClick={() => navigate('/portfolio')} style={{ textAlign: 'center', padding: '8px 0', borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, fontSize: FS.caption, fontWeight: FW.medium, color: theme.textMuted, cursor: 'pointer', marginTop: 4 }}>
        전체 포트폴리오 보기
      </Pressable>

      {/* 관심 종목 (종목 상세의 하트) */}
      {isAuthenticated && (
        <CollapsibleSection title="관심 종목" storageKey="panel.watchlist.hidden" style={{ marginTop: 8 }}>
          {!watchlistLoaded && watchlistFailed && (
            <div role="alert" style={{ fontSize: FS.caption, color: theme.error, textAlign: 'center', padding: '12px 0', lineHeight: 1.6 }}>⚠ 관심 종목을 불러오지 못했어요<br />잠시 후 자동으로 다시 시도해요</div>
          )}
          {watchlistLoaded && watchlist.length === 0 && (
            <div style={{ fontSize: FS.caption, color: theme.textMuted, textAlign: 'center', padding: '12px 0', lineHeight: 1.6 }}>
              종목 상세에서 ♡를 누르면<br />여기에 모아 보여드려요
            </div>
          )}
          {watchlist.map(w => {
            const hasPrice = w.current_price !== null && w.change !== null && w.change_rate !== null;
            const changeColor = (w.change ?? 0) >= 0 ? theme.up : theme.down;
            const sign = (w.change ?? 0) >= 0 ? '+' : '-';
            return (
              <Pressable key={w.stock_id} onClick={() => navigate(`/stock/${w.stock_code}`)} style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, padding: '12px 12px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <StockLogo name={w.stock_name} code={w.stock_code} size={30} />
                {/* 종목명은 아이콘 높이 가운데, 가격과 등락은 오른쪽에 위아래로 */}
                <span style={{ flex: 1, minWidth: 0, fontSize: FS.body, fontWeight: FW.semibold, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.stock_name}</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span style={{ fontSize: FS.caption, fontWeight: FW.semibold }}>{hasPrice ? `${w.current_price!.toLocaleString()}원` : '-'}</span>
                  {hasPrice && (
                    <span style={{ fontSize: FS.caption, fontWeight: FW.semibold, color: changeColor }}>{sign}{Math.abs(w.change!).toLocaleString()}원 ({Math.abs(w.change_rate!).toFixed(2)}%)</span>
                  )}
                </div>
              </Pressable>
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
        <span style={{ fontSize: FS.caption, fontWeight: FW.semibold, color: theme.textMuted }}>{title}</span>
        <Pressable as="span"
          onClick={toggle}
          style={{ marginLeft: 'auto', fontSize: FS.caption, fontWeight: FW.medium, color: theme.textMuted, cursor: 'pointer', padding: '2px 4px' }}
        >
          {hidden ? '보이기' : '숨기기'}
        </Pressable>
      </div>
      {/* 높이를 0fr ↔ 1fr로 바꿔 목록 높이에 상관없이 부드럽게 말려 올라가게 한다 */}
      <div style={{
        display: 'grid', gridTemplateRows: hidden ? '0fr' : '1fr',
        transition: 'grid-template-rows 0.25s ease',
      }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

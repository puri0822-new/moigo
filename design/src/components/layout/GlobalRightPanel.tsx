import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { stocks, aiRecs } from '../../data/mockData';
import StockLogo from '../StockLogo';
import { apiGet } from '../../lib/api';

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
  const [activeRec, setActiveRec] = useState(0);
  const [showRec, setShowRec] = useState(true);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { setPortfolio(null); return; }
    apiGet<PortfolioData>('/portfolio').then(res => setPortfolio(res.data)).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveRec(prev => (prev + 1) % aiRecs.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const rec = aiRecs[activeRec];
  const recStock = stocks.find(s => s.name === rec.stockName) || stocks[0];
  const recChangeLabel = (recStock.changePct >= 0 ? '▲' : '▼') + Math.abs(recStock.changePct).toFixed(1) + '%';

  return (
    <div style={{
      width: 300, flexShrink: 0,
      borderLeft: `1px solid ${theme.border}`,
      background: theme.panel,
      padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
      overflowY: 'auto',
    }}>
      {/* AI 추천 카드 */}
      {showRec && (
        <div
          onClick={() => navigate(`/stock/${recStock.code}`)}
          style={{
            background: theme.ai, borderRadius: 14, padding: '20px 18px',
            display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer',
            position: 'relative', overflow: 'hidden', minHeight: 180,
          }}
        >
          <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', right: 20, bottom: -30, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

          <div key={`rec-header-${activeRec}`} className="ai-rec-slide" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
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
    </div>
  );
}

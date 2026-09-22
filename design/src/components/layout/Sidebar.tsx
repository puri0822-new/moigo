import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import StockLogo from '../StockLogo';
import { apiGet } from '../../lib/api';

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

export default function Sidebar() {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setPortfolio(null);
      return;
    }
    apiGet<PortfolioData>('/portfolio').then(res => setPortfolio(res.data)).catch(() => {});
  }, [isAuthenticated]);

  const totalAsset = (portfolio?.balance ?? 0) + (portfolio?.total_eval_amount ?? 0);
  const profitRate = portfolio?.total_profit_loss_rate ?? 0;
  const profitColor = profitRate >= 0 ? theme.up : theme.down;
  const profitLabel = (profitRate >= 0 ? '▲' : '▼') + ' 총 ' + (profitRate >= 0 ? '+' : '') + profitRate.toFixed(2) + '%';

  return (
    <div style={{
      width: 250, flexShrink: 0,
      borderRight: `1px solid ${theme.border}`,
      background: theme.panel,
      padding: '20px 16px',
      display: 'flex', flexDirection: 'column', gap: 14,
      overflowY: 'auto',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
        color: theme.textMuted, textTransform: 'uppercase',
      }}>
        내 모의매매
      </div>

      <div
        onClick={() => navigate('/portfolio')}
        style={{
          background: theme.panel2, border: `1px solid ${theme.border}`,
          borderRadius: 10, padding: 14,
          display: 'flex', flexDirection: 'column', gap: 6,
          cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: 11, color: theme.textMuted }}>총 평가자산</div>
        {isAuthenticated && portfolio ? (
          <>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {totalAsset.toLocaleString()}원
            </div>
            <div style={{ fontSize: 12, color: profitColor, fontWeight: 600 }}>{profitLabel}</div>
            <div style={{ height: 1, background: theme.border, margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: theme.textMuted }}>
              <span>가상현금</span>
              <span style={{ color: theme.text, fontWeight: 600 }}>{portfolio.balance.toLocaleString()}원</span>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: theme.textMuted }}>로그인 후 확인 가능</div>
        )}
      </div>

      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
        color: theme.textMuted, textTransform: 'uppercase', marginTop: 6,
      }}>
        보유 종목
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!isAuthenticated && (
          <div style={{ fontSize: 12, color: theme.textMuted, textAlign: 'center', padding: '12px 0' }}>
            로그인 후 확인 가능
          </div>
        )}
        {isAuthenticated && portfolio?.holdings.length === 0 && (
          <div style={{ fontSize: 12, color: theme.textMuted, textAlign: 'center', padding: '12px 0' }}>
            보유 종목 없음
          </div>
        )}
        {portfolio?.holdings.map(h => {
          const changeColor = h.profit_loss_rate >= 0 ? theme.up : theme.down;
          const changeLabel = (h.profit_loss_rate >= 0 ? '▲' : '▼') + Math.abs(h.profit_loss_rate).toFixed(2) + '%';
          return (
            <div
              key={h.stock_id}
              onClick={() => navigate(`/stock/${h.stock_code}`)}
              style={{
                background: theme.panel2, border: `1px solid ${theme.border}`,
                borderRadius: 9, padding: '10px 12px',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StockLogo name={h.stock_name} size={28} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                  <span>{h.stock_name}</span>
                  <span style={{ color: theme.textMuted, fontWeight: 500 }}>{h.quantity}주</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: changeColor }}>{changeLabel}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{h.eval_amount.toLocaleString()}원</span>
              </div>
            </div>
          );
        })}
      </div>

      {isAuthenticated && (
        <div
          onClick={() => navigate('/portfolio')}
          style={{
            marginTop: 'auto',
            textAlign: 'center', padding: '10px 0', borderRadius: 8,
            border: `1px solid ${theme.border}`,
            fontSize: 13, fontWeight: 600, color: theme.textMuted,
            cursor: 'pointer',
          }}
        >
          포트폴리오 전체보기 →
        </div>
      )}
    </div>
  );
}

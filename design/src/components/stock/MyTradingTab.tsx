import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import StockLogo from '../StockLogo';
import AiRecCard from '../AiRecCard';
import type { ApiPortfolio } from '../../lib/api';

interface MyTradingTabProps {
  portfolio: ApiPortfolio | null;
}

// 우측 패널의 내 모의매매 탭: AI 추천 카드(오른쪽 패널과 같은 카드)와 내 자산·보유 종목
export default function MyTradingTab({ portfolio }: MyTradingTabProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const totalAsset = portfolio ? portfolio.balance + portfolio.total_eval_amount : 0;
  const profit = portfolio?.total_profit_loss ?? 0;

  return <>
    {/* AI 추천 카드 (아직 결과가 나오지 않은 실제 추천) */}
    <AiRecCard />

    <div style={{ fontSize: 13, fontWeight: 700, color: theme.ai, background: theme.aiSoft, borderRadius: 8, padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.ai}` }}>
      ✦ 내 모의매매
    </div>

    {!portfolio ? (
      <div style={{ fontSize: 12, color: theme.textMuted }}>내 모의매매 정보를 불러오지 못했습니다</div>
    ) : <>
      <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>총 평가자산</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{totalAsset.toLocaleString()}원</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: theme.textMuted }}>평가손익</span>
          <span style={{ fontWeight: 700, color: profit >= 0 ? theme.up : theme.down }}>
            {profit >= 0 ? '+' : ''}{profit.toLocaleString()}원 ({portfolio.total_profit_loss_rate.toFixed(2)}%)
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: theme.textMuted }}>가상현금</span>
          <span style={{ fontWeight: 600 }}>{portfolio.balance.toLocaleString()}원</span>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>보유 종목</div>
      {portfolio.holdings.length === 0 && (
        <div style={{ fontSize: 12, color: theme.textMuted }}>보유 중인 종목이 없습니다</div>
      )}
      {portfolio.holdings.map(h => {
        const changeColor = h.profit_loss_rate >= 0 ? theme.up : theme.down;
        const changeLabel = (h.profit_loss_rate >= 0 ? '▲' : '▼') + Math.abs(h.profit_loss_rate).toFixed(1) + '%';
        return (
          <div key={h.stock_id} onClick={() => navigate(`/stock/${h.stock_code}`)} style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <StockLogo name={h.stock_name} code={h.stock_code} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{h.stock_name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: changeColor, flexShrink: 0, marginLeft: 6 }}>{changeLabel}</span>
              </div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{h.quantity.toLocaleString()}주</div>
            </div>
          </div>
        );
      })}
    </>}

    <div onClick={() => navigate('/portfolio')} style={{ textAlign: 'center', padding: '9px 0', borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 12, fontWeight: 600, color: theme.textMuted, cursor: 'pointer', marginTop: 4 }}>
      전체 포트폴리오 보기
    </div>
  </>;
}

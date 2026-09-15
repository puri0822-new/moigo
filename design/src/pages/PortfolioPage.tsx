import { useTheme } from '../context/ThemeContext';
import { stocks, holdings } from '../data/mockData';
import StockLogo from '../components/StockLogo';

const tradeHistory = [
  { date: '2026-09-15', type: '매수', name: '삼성전자', qty: 3, price: '78,200원', total: '234,600원', profit: null },
  { date: '2026-09-14', type: '매도', name: 'SK하이닉스', qty: 2, price: '210,000원', total: '420,000원', profit: '+8,500원' },
  { date: '2026-09-13', type: '매수', name: 'NAVER', qty: 2, price: '190,000원', total: '380,000원', profit: null },
  { date: '2026-09-12', type: '매도', name: '카카오', qty: 3, price: '43,000원', total: '129,000원', profit: '-3,200원' },
  { date: '2026-09-11', type: '매수', name: 'LG에너지솔루션', qty: 1, price: '405,000원', total: '405,000원', profit: null },
] as const;

export default function PortfolioPage() {
  const { theme } = useTheme();

  const totalAsset = 12458300;
  const totalCost = 9330000;
  const totalProfit = totalAsset - totalCost;
  const profitPct = ((totalProfit / totalCost) * 100).toFixed(2);
  const profitColor = totalProfit >= 0 ? theme.up : theme.down;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', height: '100%' }}>
      <div style={{ fontSize: 18, fontWeight: 800 }}>내 포트폴리오</div>

      {/* 자산 요약 */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: '총 평가자산', value: totalAsset.toLocaleString() + '원', color: undefined },
          { label: '총 수익', value: (totalProfit >= 0 ? '+' : '') + totalProfit.toLocaleString() + '원 (' + profitPct + '%)', color: profitColor },
          { label: '가상현금', value: '3,120,000원', color: undefined },
          { label: '투자원금', value: totalCost.toLocaleString() + '원', color: undefined },
        ].map(card => (
          <div key={card.label} style={{
            flex: 1, background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 12, padding: '16px 20px',
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

      {/* 보유 종목 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>보유 종목</div>
        <div style={{
          background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 110px 110px 90px',
            padding: '10px 16px', borderBottom: `1px solid ${theme.border}`,
            fontSize: 12, fontWeight: 700, color: theme.textMuted,
          }}>
            <span>종목명</span>
            <span style={{ textAlign: 'right' }}>보유수량</span>
            <span style={{ textAlign: 'right' }}>현재가</span>
            <span style={{ textAlign: 'right' }}>평가금액</span>
            <span style={{ textAlign: 'right' }}>수익률</span>
          </div>
          {holdings.map(h => {
            const stock = stocks.find(s => s.name === h.name) || stocks[0];
            const priceNum = parseInt(stock.price.replace(/[^0-9]/g, ''), 10);
            const qtyNum = parseInt(h.qty.replace(/[^0-9]/g, ''), 10);
            const evaluated = priceNum * qtyNum;
            const changeColor = h.changePct >= 0 ? theme.up : theme.down;
            const changeLabel = (h.changePct >= 0 ? '▲' : '▼') + Math.abs(h.changePct).toFixed(1) + '%';
            return (
              <div key={h.name} style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 110px 110px 90px',
                padding: '12px 16px', borderBottom: `1px solid ${theme.border}`,
                fontSize: 13, alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StockLogo name={h.name} size={28} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{h.name}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted }}>{stock.code}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>{h.qty}</div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>{stock.price}</div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>{evaluated.toLocaleString()}원</div>
                <div style={{ textAlign: 'right', fontWeight: 700, color: changeColor }}>{changeLabel}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 거래 내역 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>거래 내역</div>
        <div style={{
          background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '100px 50px 1fr 60px 90px 110px 100px',
            padding: '10px 16px', borderBottom: `1px solid ${theme.border}`,
            fontSize: 12, fontWeight: 700, color: theme.textMuted,
          }}>
            <span>날짜</span>
            <span>구분</span>
            <span>종목명</span>
            <span style={{ textAlign: 'right' }}>수량</span>
            <span style={{ textAlign: 'right' }}>단가</span>
            <span style={{ textAlign: 'right' }}>거래금액</span>
            <span style={{ textAlign: 'right' }}>실현손익</span>
          </div>
          {tradeHistory.map((t, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '100px 50px 1fr 60px 90px 110px 100px',
              padding: '11px 16px', borderBottom: `1px solid ${theme.border}`,
              fontSize: 13, alignItems: 'center',
            }}>
              <span style={{ color: theme.textMuted, fontSize: 12 }}>{t.date}</span>
              <span style={{
                fontWeight: 700, fontSize: 12,
                color: t.type === '매수' ? theme.up : theme.down,
              }}>
                {t.type}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <StockLogo name={t.name} size={22} />
                <span style={{ fontWeight: 600 }}>{t.name}</span>
              </div>
              <span style={{ textAlign: 'right' }}>{t.qty}주</span>
              <span style={{ textAlign: 'right' }}>{t.price}</span>
              <span style={{ textAlign: 'right', fontWeight: 600 }}>{t.total}</span>
              <span style={{
                textAlign: 'right', fontWeight: 700,
                color: t.profit
                  ? t.profit.startsWith('+') ? theme.up : theme.down
                  : theme.textMuted,
              }}>
                {t.profit ?? '-'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

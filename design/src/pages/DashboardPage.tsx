import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { aiRecs } from '../data/mockData';
import type { Stock } from '../types';
import StockLogo from '../components/StockLogo';
import { fetchStocks } from '../lib/api';

export default function DashboardPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchStocks()
      .then(apiStocks => {
        setStocks(
          apiStocks.map((s, i) => ({
            rank: i + 1,
            name: s.name,
            code: s.code,
            price: s.current_price != null ? `${s.current_price.toLocaleString()}원` : '-',
            volume: '-', // TODO: 백엔드에 거래량 데이터 연동 후 채우기
            changePct: s.change_rate != null ? s.change_rate * 100 : 0,
            aiReason: '',
            aiComment: '',
            similar: [],
            news: [],
          }))
        );
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: 24, color: theme.textMuted }}>불러오는 중...</div>;
  }

  if (error) {
    return <div style={{ padding: 24, color: theme.down }}>종목 정보를 불러오지 못했습니다. 백엔드 서버가 켜져 있는지 확인해주세요.</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* 거래량 랭킹 */}
      <div style={{
        flex: 1, minWidth: 0, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>🔥 실시간 거래량 랭킹</div>
          <div style={{ fontSize: 12, color: theme.textMuted }}>거래량 기준 · 실시간</div>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 1,
          background: theme.border, border: `1px solid ${theme.border}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          {stocks.map(s => {
            const changeColor = s.changePct >= 0 ? theme.up : theme.down;
            const changeLabel = (s.changePct >= 0 ? '▲' : '▼') + Math.abs(s.changePct).toFixed(1) + '%';
            return (
              <div
                key={s.code}
                onClick={() => navigate(`/stock/${s.code}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 18px', background: theme.panel, cursor: 'pointer',
                }}
              >
                <div style={{ width: 22, flexShrink: 0, fontSize: 13, fontWeight: 700, color: theme.textMuted }}>
                  {s.rank}
                </div>
                <StockLogo name={s.name} size={36} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{s.price}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 11 }}>
                    <span style={{ color: theme.textMuted }}>거래량 {s.volume}</span>
                    <span style={{ fontWeight: 700, color: changeColor, flexShrink: 0 }}>{changeLabel}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI 추천 패널 */}
      <div style={{
        width: 300, flexShrink: 0,
        borderLeft: `1px solid ${theme.border}`,
        background: theme.panel,
        padding: 20,
        display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: theme.ai }}>
          <span>✨</span><span>AI 추천 &amp; 등락 이유</span>
        </div>

        {aiRecs.map((a, i) => {
          const stock = stocks.find(s => s.name === a.stockName) || stocks[0];
          const changeColor = stock.changePct >= 0 ? theme.up : theme.down;
          const changeLabel = (stock.changePct >= 0 ? '▲' : '▼') + Math.abs(stock.changePct).toFixed(1) + '%';
          return (
            <div
              key={i}
              onClick={() => navigate(`/stock/${stock.code}`)}
              style={{
                background: theme.panel2, border: `1px solid ${theme.border}`,
                borderRadius: 10, padding: 12,
                display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: theme.textMuted }}>
                <span>🤖</span><span>{a.bot}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{a.stockName}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: changeColor }}>{changeLabel}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>{a.reason}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

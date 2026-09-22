import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { stocks, orderbook } from '../data/mockData';
import StockLogo from '../components/StockLogo';
import { createOrder, getStocks, getAccount, type StockInfo, type AccountInfo } from '../lib/api';

const periods = ['1일', '1주', '1개월', '1년'];

export default function StockDetailPage() {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qty, setQty] = useState(1);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [period, setPeriod] = useState('1일');
  const [loading, setLoading] = useState(false);
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);

  const stock = stocks.find(s => s.code === code) || stocks[0];
  const changeColor = stock.changePct >= 0 ? theme.up : theme.down;
  const changeLabel = (stock.changePct >= 0 ? '▲' : '▼') + Math.abs(stock.changePct).toFixed(1) + '%';
  const priceNum = parseInt(stock.price.replace(/[^0-9]/g, ''), 10);
  const total = priceNum * qty;

  useEffect(() => {
    getStocks().then(res => {
      const found = res.data.find(s => s.code === code);
      setStockInfo(found ?? null);
    }).catch(() => {});

    if (isAuthenticated) {
      getAccount().then(res => setAccount(res.data)).catch(() => {});
    }
  }, [code, isAuthenticated]);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2600);
  };

  const handleOrder = async () => {
    if (!isAuthenticated) {
      showToast('로그인이 필요합니다', false);
      return;
    }
    if (!stockInfo) {
      showToast('종목 정보를 불러오는 중입니다', false);
      return;
    }

    setLoading(true);
    try {
      const res = await createOrder({
        stock_id: stockInfo.id,
        order_type: side === 'buy' ? 'BUY' : 'SELL',
        quantity: qty,
        price: priceNum,
      });
      showToast(
        `${side === 'buy' ? '매수' : '매도'} 체결: ${res.data.stock_name} ${qty}주 · ${total.toLocaleString()}원`,
        true,
      );
      getAccount().then(r => setAccount(r.data)).catch(() => {});
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '주문 실패', false);
    } finally {
      setLoading(false);
    }
  };

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
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.01em' }}>{stock.price}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: changeColor }}>{changeLabel}</div>
          <div style={{ fontSize: 12, color: theme.textMuted }}>거래량 {stock.volume}</div>
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
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme.textMuted, fontSize: 13,
            background: `repeating-linear-gradient(45deg, ${theme.panel2} 0 10px, transparent 10px 20px)`,
          }}>
            캔들 차트 영역
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
              onClick={!loading ? handleOrder : undefined}
              style={{
                textAlign: 'center', padding: '10px 0', borderRadius: 8,
                background: loading ? theme.border : (side === 'buy' ? theme.up : theme.down),
                color: theme.bg, fontWeight: 700, fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '처리 중...' : `${side === 'buy' ? '매수' : '매도'} 주문 실행`}
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
          {stock.news.map((n, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              padding: '10px 0', borderBottom: `1px solid ${theme.border}`,
            }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
              <div style={{ fontSize: 11, color: theme.textMuted }}>{n.source} · {n.time}</div>
            </div>
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
          <span>✨</span><span>AI 인사이트</span>
        </div>

        <div style={{
          background: theme.panel2, border: `1px solid ${theme.border}`,
          borderRadius: 10, padding: 14,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>뉴스 기반 등락 이유</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{stock.aiReason}</div>
        </div>

        <div style={{
          background: theme.panel2, border: `1px solid ${theme.border}`,
          borderRadius: 10, padding: 14,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>참고 코멘트</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{stock.aiComment}</div>
          <div style={{ fontSize: 10.5, color: theme.textMuted, lineHeight: 1.5 }}>
            ※ 투자 참고용 정보이며 투자 조언이 아닙니다.
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>유사 종목</div>
        {stock.similar.map(s => (
          <div key={s} style={{
            padding: '8px 10px', background: theme.panel2, border: `1px solid ${theme.border}`,
            borderRadius: 8, fontSize: 12, fontWeight: 600,
          }}>
            {s}
          </div>
        ))}
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

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { stocks, orderbook, aiRecs, holdings, stockAiInsights } from '../data/mockData';
import StockLogo from '../components/StockLogo';

const periods = ['1일', '1주', '1개월', '1년'] as const;

const mockPortfolio = {
  totalAsset: 12_480_000,
  balance: 3_200_000,
  totalProfit: 480_000,
  profitRate: 4.0,
};

export default function StockDetailPage() {
  const { theme } = useTheme();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [inputPrice, setInputPrice] = useState(0);
  const [qty, setQty] = useState(1);
  const [period, setPeriod] = useState<(typeof periods)[number]>('1일');
  const [liked, setLiked] = useState(false);
  const [alerted, setAlerted] = useState(false);
  const [mainTab, setMainTab] = useState<'chart' | 'info' | 'news' | 'community'>('chart');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [rightTab, setRightTab] = useState<'insight' | 'portfolio'>('insight');
  const [orderHistory, setOrderHistory] = useState<{ side: 'buy' | 'sell'; type: 'limit' | 'market'; price: number; qty: number; total: number; time: string }[]>([]);
  const [floatPos, setFloatPos] = useState({ x: 0, y: 0 });
  const [floatMinimized, setFloatMinimized] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    setFloatPos({ x: window.innerWidth - 316, y: window.innerHeight - 540 });
  }, []);

  // AI 추천 자동 전환
  const [activeRec, setActiveRec] = useState(0);
  const [showRec, setShowRec] = useState(true);
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveRec(prev => (prev + 1) % aiRecs.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const stock = stocks.find(s => s.code === code) ?? stocks[0];
  const priceNum = parseInt(stock.price.replace(/[^0-9]/g, ''), 10);

  // 지정가 초기값 설정
  useEffect(() => { setInputPrice(priceNum); }, [priceNum]);

  const effectivePrice = orderType === 'market' ? priceNum : inputPrice;
  const total = effectivePrice * qty;

  const rec = aiRecs[activeRec];
  const recStock = stocks.find(s => s.name === rec.stockName) || stocks[0];
  const recChangeLabel = (recStock.changePct >= 0 ? '▲' : '▼') + Math.abs(recStock.changePct).toFixed(1) + '%';

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2600);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: floatPos.x, origY: floatPos.y };
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setFloatPos({
        x: Math.max(0, Math.min(window.innerWidth - 300, dragRef.current.origX + e.clientX - dragRef.current.startX)),
        y: Math.max(0, Math.min(window.innerHeight - 48, dragRef.current.origY + e.clientY - dragRef.current.startY)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleOrder = (orderSide?: 'buy' | 'sell') => {
    const s = orderSide ?? side;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setOrderHistory(prev => [{ side: s, type: orderType, price: effectivePrice, qty, total, time }, ...prev]);
    showToast(`${s === 'buy' ? '매수' : '매도'} 체결: ${stock.name} ${qty}주 · ${total.toLocaleString()}원`, true);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100%', alignItems: 'flex-start' }}>
      {/* 메인 콘텐츠 */}
      <div style={{
        flex: 1, minWidth: 0, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            alignSelf: 'flex-start',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 8, border: `1px solid ${theme.border}`,
            fontSize: 13, fontWeight: 600, color: theme.textMuted,
            cursor: 'pointer', background: 'transparent', fontFamily: 'inherit',
          }}
        >
          ← 이전으로
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StockLogo name={stock.name} code={stock.code} size={48} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800 }}>{stock.name}</span>
              <span style={{ fontSize: 13, color: theme.textMuted, fontWeight: 500 }}>{stock.code}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* 알림 아이콘 */}
                <div
                  onClick={() => setAlerted(v => !v)}
                  style={{
                    width: 34, height: 34, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 17,
                    background: alerted ? theme.aiSoft : theme.panel2,
                    border: `1px solid ${alerted ? theme.ai : theme.border}`,
                    color: alerted ? theme.ai : theme.textMuted,
                    transition: 'all 0.2s',
                  }}
                >🔔</div>
                {/* 즐겨찾기 아이콘 */}
                <div
                  onClick={() => setLiked(v => !v)}
                  style={{
                    width: 34, height: 34, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 17,
                    background: liked ? 'rgba(239,68,68,0.08)' : theme.panel2,
                    border: `1px solid ${liked ? '#ef4444' : theme.border}`,
                    transition: 'all 0.2s',
                  }}
                >{liked ? '❤️' : '🤍'}</div>
              </div>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              fontSize: 12, fontWeight: 600, color: theme.ai,
              background: theme.aiSoft, border: `1px solid ${theme.ai}`,
              borderRadius: 6, padding: '2px 8px', alignSelf: 'flex-start',
            }}>
              {stock.sector}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.01em' }}>{stock.price}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: stock.changePct >= 0 ? theme.up : theme.down }}>
            {(() => {
              const changeWon = Math.round(priceNum * stock.changePct / (100 + stock.changePct));
              const sign = stock.changePct >= 0 ? '+' : '';
              return `어제보다 ${sign}${changeWon.toLocaleString()}원 (${Math.abs(stock.changePct).toFixed(1)}%)`;
            })()}
          </div>
          <div style={{ fontSize: 12, color: theme.textMuted }}>거래량 {stock.volume}</div>
        </div>

        {/* 카테고리 탭 바 */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${theme.border}`, marginBottom: -8 }}>
          {([
            ['chart', '차트 · 호가'],
            ['info', '종목정보'],
            ['news', '뉴스 · 공시'],
            ['community', '커뮤니티'],
          ] as const).map(([key, label]) => (
            <div
              key={key}
              onClick={() => setMainTab(key)}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: mainTab === key ? 700 : 500,
                color: mainTab === key ? theme.ai : theme.textMuted,
                borderBottom: mainTab === key ? `2px solid ${theme.ai}` : '2px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >{label}</div>
          ))}
        </div>

        {/* 차트 · 호가 탭 */}
        {mainTab === 'chart' && <>
          <div style={{
            background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 12, height: 260, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: `1px solid ${theme.border}` }}>
              {periods.map(p => (
                <div key={p} onClick={() => setPeriod(p)} style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                  background: period === p ? theme.ai : 'transparent',
                  color: period === p ? theme.aiText : theme.textMuted,
                }}>{p}</div>
              ))}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted, fontSize: 13 }}>
              차트 영역 ({period})
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {/* 호가 */}
            <div style={{
              flex: 1, background: theme.panel, border: `1px solid ${theme.border}`,
              borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 6,
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

          {/* 주문 내역 */}
          <div style={{ flex: 1, background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>주문 내역</span>
              {orderHistory.length > 0 && (
                <span
                  onClick={() => setOrderHistory([])}
                  style={{ fontSize: 11, color: theme.textMuted, cursor: 'pointer' }}
                >전체 삭제</span>
              )}
            </div>
            {orderHistory.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: theme.textMuted }}>
                주문 내역이 없습니다
              </div>
            ) : (
              <div>
                {/* 헤더 */}
                <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr 1fr 64px', gap: 8, padding: '7px 16px', borderBottom: `1px solid ${theme.border}`, fontSize: 11, fontWeight: 600, color: theme.textMuted }}>
                  <span>구분</span><span>가격</span><span style={{ textAlign: 'center' }}>수량</span><span style={{ textAlign: 'right' }}>금액</span><span style={{ textAlign: 'right' }}>시간</span>
                </div>
                {orderHistory.map((o, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr 1fr 64px', gap: 8, padding: '9px 16px', borderBottom: i < orderHistory.length - 1 ? `1px solid ${theme.border}` : 'none', fontSize: 12, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: o.side === 'buy' ? theme.up : theme.down }}>
                      {o.side === 'buy' ? '매수' : '매도'}
                    </span>
                    <span style={{ color: theme.text }}>
                      {o.type === 'market' ? '시장가' : `${o.price.toLocaleString()}원`}
                    </span>
                    <span style={{ textAlign: 'center', color: theme.text }}>{o.qty.toLocaleString()}주</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{o.total.toLocaleString()}원</span>
                    <span style={{ textAlign: 'right', color: theme.textMuted, fontSize: 11 }}>{o.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        </>}

        {/* 종목정보 탭 */}
        {mainTab === 'info' && (
          <div style={{
            background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 12, padding: 24, minHeight: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme.textMuted, fontSize: 13,
          }}>
            종목정보 준비 중
          </div>
        )}

        {/* 뉴스 · 공시 탭 */}
        {mainTab === 'news' && (
          <div style={{
            background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
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
        )}

        {/* 커뮤니티 탭 */}
        {mainTab === 'community' && (
          <div style={{
            background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 12, padding: 24, minHeight: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme.textMuted, fontSize: 13,
          }}>
            커뮤니티 준비 중
          </div>
        )}
      </div>

      {/* 우측 패널 (탭) */}
      <div style={{
        width: 300, flexShrink: 0,
        borderLeft: `1px solid ${theme.border}`,
        background: theme.panel,
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0,
        height: 'calc(100vh - 64px)', overflowY: 'auto',
      }}>
        {/* 탭 */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
          {([['insight', 'AI 인사이트'], ['portfolio', '내 모의매매']] as const).map(([key, label]) => (
            <div
              key={key}
              onClick={() => setRightTab(key)}
              style={{
                flex: 1, textAlign: 'center', padding: '14px 0',
                fontSize: 13, fontWeight: rightTab === key ? 700 : 500,
                color: rightTab === key ? theme.ai : theme.textMuted,
                borderBottom: rightTab === key ? `2px solid ${theme.ai}` : '2px solid transparent',
                cursor: 'pointer',
              }}
            >{label}</div>
          ))}
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* AI 인사이트 탭 */}
          {rightTab === 'insight' && <>
            {/* 등락 이유 */}
            <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>등락 이유</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>{stock.aiReason}</div>
            </div>

            {/* AI별 추천 코멘트 */}
            {(() => {
              const insights = stockAiInsights.filter(i => i.stockName === stock.name);
              if (insights.length === 0) return null;
              return <>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>AI별 코멘트</div>
                {insights.map((ins, idx) => {
                  const signalColor = ins.signal === '매수' ? theme.up : ins.signal === '매도' ? theme.down : theme.textMuted;
                  return (
                    <div key={idx} style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: theme.aiSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          <img src={ins.icon} alt={ins.bot} width={16} height={16} style={{ objectFit: 'contain' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{ins.bot}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: signalColor, border: `1px solid ${signalColor}`, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>{ins.signal}</span>
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.6, color: theme.text }}>{ins.comment}</div>

                      {ins.sources.length > 0 && (
                        <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, letterSpacing: '0.03em' }}>근거 뉴스</div>
                          {ins.sources.map((src, si) => (
                            <div key={si} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 500, color: theme.text, lineHeight: 1.4 }}>· {src.title}</div>
                              <div style={{ fontSize: 10, color: theme.textMuted }}>{src.source} · {src.time}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>;
            })()}

            {/* 유사 종목 */}
            <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>유사 종목</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {stock.similar.map(name => (
                <div key={name} style={{ padding: '5px 10px', borderRadius: 20, border: `1px solid ${theme.border}`, fontSize: 12, color: theme.textMuted, cursor: 'pointer' }}
                  onClick={() => { const s = stocks.find(s => s.name === name); if (s) navigate(`/stock/${s.code}`); }}>
                  {name}
                </div>
              ))}
            </div>
          </>}

          {/* 내 모의매매 탭 */}
          {rightTab === 'portfolio' && <>
            {/* AI 추천 카드 */}
            {showRec && (
              <div
                onClick={() => navigate(`/stock/${recStock.code}`)}
                style={{
                  background: theme.ai, borderRadius: 14, padding: '18px 16px',
                  display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer',
                  position: 'relative', overflow: 'hidden', minHeight: 180,
                }}
              >
                <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ position: 'absolute', right: 20, bottom: -30, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

                <div key={`rec-header-${activeRec}`} className="ai-rec-slide" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
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

            <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>총 평가자산</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{mockPortfolio.totalAsset.toLocaleString()}원</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: theme.textMuted }}>수익</span>
                <span style={{ fontWeight: 700, color: theme.up }}>+{mockPortfolio.totalProfit.toLocaleString()}원 ({mockPortfolio.profitRate.toFixed(2)}%)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: theme.textMuted }}>가상현금</span>
                <span style={{ fontWeight: 600 }}>{mockPortfolio.balance.toLocaleString()}원</span>
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>보유 종목</div>
            {holdings.map(h => {
              const changeColor = h.changePct >= 0 ? theme.up : theme.down;
              const changeLabel = (h.changePct >= 0 ? '▲' : '▼') + Math.abs(h.changePct).toFixed(1) + '%';
              const hStock = stocks.find(s => s.name === h.name);
              return (
                <div key={h.name} onClick={() => hStock && navigate(`/stock/${hStock.code}`)} style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <StockLogo name={h.name} code={hStock?.code} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{h.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: changeColor, flexShrink: 0, marginLeft: 6 }}>{changeLabel}</span>
                    </div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{h.qty}</div>
                  </div>
                </div>
              );
            })}

            <div onClick={() => navigate('/portfolio')} style={{ textAlign: 'center', padding: '9px 0', borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 12, fontWeight: 600, color: theme.textMuted, cursor: 'pointer', marginTop: 4 }}>
              전체 포트폴리오 보기
            </div>
          </>}
        </div>
      </div>

      {/* 플로팅 주문 박스 */}
      <div style={{
        position: 'fixed', left: floatPos.x, top: floatPos.y,
        width: 292, zIndex: 40,
        background: theme.panel, border: `1px solid ${theme.border}`,
        borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        overflow: 'hidden',
      }}>
        {/* 드래그 핸들 */}
        <div
          onMouseDown={handleDragStart}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: floatMinimized ? 'none' : `1px solid ${theme.border}`,
            cursor: 'grab', userSelect: 'none', background: theme.panel2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 11, color: theme.textMuted }}>⠿</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{stock.name} 모의주문</span>
          </div>
          <div
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setFloatMinimized(v => !v)}
            style={{ fontSize: 14, color: theme.textMuted, cursor: 'pointer', lineHeight: 1, padding: '2px 4px' }}
          >{floatMinimized ? '▲' : '▼'}</div>
        </div>

        {!floatMinimized && (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
            {/* 지정가 / 시장가 탭 */}
            <div style={{ display: 'flex', background: theme.panel2, borderRadius: 8, padding: 3, gap: 3 }}>
              {(['limit', 'market'] as const).map(t => (
                <div key={t} onClick={() => setOrderType(t)} style={{
                  flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 6,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: orderType === t ? theme.panel : 'transparent',
                  color: orderType === t ? theme.text : theme.textMuted,
                  boxShadow: orderType === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}>
                  {t === 'limit' ? '지정가' : '시장가'}
                </div>
              ))}
            </div>

            {/* 가격 입력 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted }}>가격</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '6px 10px', background: orderType === 'market' ? theme.panel2 : 'transparent' }}>
                <div onClick={() => orderType === 'limit' && setInputPrice(p => Math.max(0, p - 100))}
                  style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: orderType === 'limit' ? 'pointer' : 'default', flexShrink: 0, opacity: orderType === 'market' ? 0.4 : 1 }}>-</div>
                {orderType === 'market' ? (
                  <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: theme.textMuted }}>시장가</span>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <input type="text" inputMode="numeric"
                      value={inputPrice === 0 ? '' : inputPrice.toLocaleString()}
                      onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); setInputPrice(raw === '' ? 0 : parseInt(raw, 10)); }}
                      placeholder="0"
                      style={{ width: 0, flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', color: theme.text, fontFamily: 'inherit' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted, flexShrink: 0 }}>원</span>
                  </div>
                )}
                <div onClick={() => orderType === 'limit' && setInputPrice(p => p + 100)}
                  style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: orderType === 'limit' ? 'pointer' : 'default', flexShrink: 0, opacity: orderType === 'market' ? 0.4 : 1 }}>+</div>
              </div>
            </div>

            {/* 수량 입력 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted }}>수량</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '6px 10px' }}>
                <div onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>-</div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <input type="text" inputMode="numeric"
                    value={qty === 0 ? '' : qty.toLocaleString()}
                    onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); setQty(raw === '' ? 1 : Math.max(1, parseInt(raw, 10))); }}
                    placeholder="0"
                    style={{ width: 0, flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', color: theme.text, fontFamily: 'inherit' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted, flexShrink: 0 }}>주</span>
                </div>
                <div onClick={() => setQty(q => q + 1)} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>+</div>
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {[['10%', 0.1], ['25%', 0.25], ['50%', 0.5], ['최대', 1]].map(([label, ratio]) => (
                  <div key={label as string}
                    onClick={() => { const maxQty = Math.floor(mockPortfolio.balance / effectivePrice); setQty(Math.max(1, Math.floor(maxQty * (ratio as number)))); }}
                    style={{ flex: 1, textAlign: 'center', padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: theme.panel2, border: `1px solid ${theme.border}`, color: theme.textMuted }}
                  >{label}</div>
                ))}
              </div>
            </div>

            {/* 총 주문 금액 */}
            <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: theme.textMuted }}>총 주문 금액</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{total.toLocaleString()}원</span>
            </div>

            {/* 매수 / 매도 버튼 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div onClick={() => handleOrder('buy')} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: theme.up, color: theme.bg, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>매수</div>
              <div onClick={() => handleOrder('sell')} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: theme.down, color: theme.bg, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>매도</div>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? theme.up : theme.down,
          borderRadius: 10, padding: '12px 20px', fontSize: 13, fontWeight: 600,
          color: theme.bg, boxShadow: '0 8px 24px rgba(0,0,0,.3)', zIndex: 50, whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import StockLogo from '../StockLogo';
import { fetchStockRankings, getPortfolio, type ApiPortfolio, type ApiStockRanking } from '../../lib/api';

// 시세 캐시 갱신 주기(30초)에 맞춰 평가금액·등락률을 다시 받아온다
const REFRESH_MS = 30_000;

const REC_LABEL: Record<string, '매수' | '매도' | '중립'> = {
  BUY: '매수',
  HOLD: '중립',
  SELL: '매도',
};

const BOT_META = {
  Gemini: { icon: 'https://www.google.com/s2/favicons?domain=gemini.google.com&sz=64' },
  Claude: { icon: 'https://www.google.com/s2/favicons?domain=anthropic.com&sz=64' },
  CLOVA: { icon: 'https://www.google.com/s2/favicons?domain=naver.com&sz=64' },
} as const;

type RealAiRec = {
  bot: keyof typeof BOT_META;
  stockName: string;
  code: string;
  reason: string;
  signal: '매수' | '매도' | '중립';
  changePct: number | null;
};

function buildRecs(rankings: ApiStockRanking[]): RealAiRec[] {
  const out: RealAiRec[] = [];
  for (const s of rankings) {
    if (!s.ai?.insights?.length) continue;
    const changePct = s.change_rate != null ? s.change_rate * 100 : null;
    for (const ins of s.ai.insights) {
      out.push({
        bot: ins.bot,
        stockName: s.name,
        code: s.code,
        reason: ins.summary,
        signal: REC_LABEL[ins.recommendation] ?? '중립',
        changePct,
      });
    }
  }
  return out;
}

export default function GlobalRightPanel() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [activeRec, setActiveRec] = useState(0);
  const [showRec, setShowRec] = useState(true);
  const [portfolio, setPortfolio] = useState<ApiPortfolio | null>(null);
  const [portfolioError, setPortfolioError] = useState(false);
  const [rankings, setRankings] = useState<ApiStockRanking[]>([]);

  // 패널은 페이지를 옮겨도 계속 떠 있으므로, 다른 페이지에서 주문하고 돌아왔을 때도 반영되게 경로가 바뀔 때마다 다시 불러온다
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getPortfolio()
        .then(res => { if (!cancelled) { setPortfolio(res.data); setPortfolioError(false); } })
        .catch(() => { if (!cancelled) setPortfolioError(true); });
      fetchStockRankings()
        .then(data => { if (!cancelled) setRankings(data); })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [pathname]);

  const recs = useMemo(() => buildRecs(rankings), [rankings]);

  useEffect(() => {
    if (recs.length === 0) return;
    const timer = setInterval(() => {
      setActiveRec(prev => (prev + 1) % recs.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [recs.length]);

  useEffect(() => {
    if (recs.length === 0) {
      setActiveRec(0);
      return;
    }
    setActiveRec(prev => prev % recs.length);
  }, [recs.length]);

  const rec = recs.length > 0 ? recs[activeRec % recs.length] : null;
  const recChangePct = rec?.changePct ?? null;
  const recChangeLabel = recChangePct == null ? '' : (recChangePct >= 0 ? '▲' : '▼') + Math.abs(recChangePct).toFixed(1) + '%';
  const signalColor = rec?.signal === '매수' ? '#fca5a5' : rec?.signal === '매도' ? '#93c5fd' : 'rgba(255,255,255,0.75)';

  const totalAsset = portfolio ? portfolio.balance + portfolio.total_eval_amount : 0;
  const profit = portfolio?.total_profit_loss ?? 0;

  return (
    <div style={{
      width: 300, flexShrink: 0,
      borderLeft: `1px solid ${theme.border}`,
      background: theme.panel,
      padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
      overflowY: 'auto',
    }}>
      {/* AI 뉴스 분석 카드 (실데이터) */}
      {showRec && (
        rec ? (
          <div
            onClick={() => navigate(`/stock/${rec.code}`)}
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
                <img src={BOT_META[rec.bot].icon} alt={rec.bot} width={20} height={20} style={{ objectFit: 'contain' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{rec.bot}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, color: signalColor,
                border: `1px solid ${signalColor}`, borderRadius: 4, padding: '1px 5px',
              }}>{rec.signal}</span>
              <div onClick={e => { e.stopPropagation(); setShowRec(false); }} style={{ marginLeft: 'auto', width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}>✕</div>
            </div>

            <div key={`rec-body-${activeRec}`} className="ai-rec-slide">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <StockLogo name={rec.stockName} code={rec.code} size={20} />
                <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{rec.stockName}</span>
                {recChangePct != null && (
                  <span style={{ fontSize: 13, fontWeight: 700, color: recChangePct >= 0 ? '#fca5a5' : '#93c5fd' }}>{recChangeLabel}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, wordBreak: 'keep-all' }}>{rec.reason}</div>
            </div>
          </div>
        ) : (
          <div style={{
            background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '16px 14px',
            fontSize: 12, color: theme.textMuted, lineHeight: 1.5,
          }}>
            아직 저장된 AI 뉴스 분석이 없습니다. 종목 상세에서 뉴스 분석을 실행하면 여기에 표시됩니다.
          </div>
        )
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: theme.ai, background: theme.aiSoft, borderRadius: 8, padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.ai}` }}>
        ✦ 내 모의매매
      </div>

      {!portfolio ? (
        <div style={{ fontSize: 12, color: theme.textMuted }}>
          {portfolioError ? '내 모의매매 정보를 불러오지 못했습니다' : '불러오는 중...'}
        </div>
      ) : <>
        {/* 총 평가자산 */}
        <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>총 평가자산</div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>{totalAsset.toLocaleString()}원</div>
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

        {/* 보유 종목 */}
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>보유 종목</div>
        {portfolio.holdings.length === 0 && (
          <div style={{ fontSize: 12, color: theme.textMuted }}>보유 중인 종목이 없습니다</div>
        )}
        {portfolio.holdings.map(h => {
          const changeColor = h.profit_loss_rate >= 0 ? theme.up : theme.down;
          const sign = h.profit_loss >= 0 ? '+' : '-';
          return (
            <div key={h.stock_id} onClick={() => navigate(`/stock/${h.stock_code}`)} style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <StockLogo name={h.stock_name} code={h.stock_code} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.stock_name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>{h.avg_price.toLocaleString()}원</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 }}>
                  <span style={{ fontSize: 11, color: theme.textMuted }}>{h.quantity.toLocaleString()}주</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: changeColor, flexShrink: 0 }}>{sign}{Math.abs(h.profit_loss).toLocaleString()}원 ({Math.abs(h.profit_loss_rate).toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          );
        })}
      </>}

      <div onClick={() => navigate('/portfolio')} style={{ textAlign: 'center', padding: '9px 0', borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 12, fontWeight: 600, color: theme.textMuted, cursor: 'pointer', marginTop: 4 }}>
        전체 포트폴리오 보기
      </div>
    </div>
  );
}

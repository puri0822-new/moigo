import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import StockLogo from '../StockLogo';
import type { ApiPortfolio, ApiStockRanking } from '../../lib/api';
import { BOT_META, REC_LABEL, type BotName, type Signal } from './shared';

type RealAiRec = {
  bot: BotName;
  stockName: string;
  code: string;
  reason: string;
  signal: Signal;
  changePct: number | null;
};

function buildRecsFromRankings(rankings: ApiStockRanking[]): RealAiRec[] {
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

interface MyTradingTabProps {
  // AI 추천 카드용 실분석 (랭킹 API의 최신 insights)
  rankings: ApiStockRanking[];
  portfolio: ApiPortfolio | null;
}

// 우측 패널의 내 모의매매 탭: AI 뉴스 분석 카드(6초마다 넘어감)와 내 자산·보유 종목
export default function MyTradingTab({ rankings, portfolio }: MyTradingTabProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [activeRec, setActiveRec] = useState(0);
  const [showRec, setShowRec] = useState(true);

  const aiRecs = buildRecsFromRankings(rankings);
  useEffect(() => {
    if (aiRecs.length === 0) return;
    const timer = setInterval(() => {
      setActiveRec(prev => (prev + 1) % aiRecs.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [aiRecs.length]);

  const rec = aiRecs.length > 0 ? aiRecs[activeRec % aiRecs.length] : null;
  const recChangePct = rec?.changePct ?? null;
  const recChangeLabel = recChangePct == null ? '' : (recChangePct >= 0 ? '▲' : '▼') + Math.abs(recChangePct).toFixed(1) + '%';
  const recSignalColor = rec?.signal === '매수' ? '#fca5a5' : rec?.signal === '매도' ? '#93c5fd' : 'rgba(255,255,255,0.75)';

  const totalAsset = portfolio ? portfolio.balance + portfolio.total_eval_amount : 0;
  const profit = portfolio?.total_profit_loss ?? 0;

  return <>
    {/* AI 뉴스 분석 카드 (실데이터) */}
    {showRec && (
      rec ? (
        <div
          onClick={() => navigate(`/stock/${rec.code}`)}
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
              <img src={BOT_META[rec.bot].icon} alt={rec.bot} width={20} height={20} style={{ objectFit: 'contain' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{rec.bot}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, color: recSignalColor,
              border: `1px solid ${recSignalColor}`, borderRadius: 4, padding: '1px 5px',
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
          background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '14px 12px',
          fontSize: 12, color: theme.textMuted, lineHeight: 1.5,
        }}>
          저장된 AI 뉴스 분석이 없습니다. AI 인사이트 탭에서 분석을 실행해 주세요.
        </div>
      )
    )}

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

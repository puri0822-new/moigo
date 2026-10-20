import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import AiIcon from '../AiIcon';
import { timeAgo } from '../../lib/time';
import { findAiProfile, useAiModels } from '../../lib/aiModels';
import { useAiRecommendations } from '../../lib/aiRecommendations';
import type { ApiAiAnalysis, ApiStock, ApiStockAiReason } from '../../lib/api';
import { BOT_META, REC_LABEL, type BotName, type Signal } from './shared';

interface AiInsightTabProps {
  code: string | undefined;
  // 오늘 등락 이유 (AI가 오늘 등락률·시장 지수·최신 뉴스로 쓴 것)
  aiReason: ApiStockAiReason | null;
  aiReasonStatus: 'loading' | 'ready';
  // 뉴스 분석 (Gemini·Claude·CLOVA가 이 종목 최신 뉴스를 읽고 낸 의견)
  analysis: ApiAiAnalysis | null;
  status: 'loading' | 'ready' | 'empty' | 'error';
  analyzing: boolean;
  error: string | null;
  onRun: () => void;
  similarStocks: ApiStock[];
}

// 우측 패널의 AI 인사이트 탭: 오늘 등락 이유, AI 추천 종합 의견·코멘트, 뉴스 분석, 같은 업종 종목
export default function AiInsightTab({
  code, aiReason, aiReasonStatus, analysis, status, analyzing, error, onRun, similarStocks,
}: AiInsightTabProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const aiModels = useAiModels();
  const { current: currentAiRecs } = useAiRecommendations();
  // 이 종목에 대한, 아직 결과가 나오지 않은 실제 AI 추천 (AI 표시 순서대로)
  const stockRecs = currentAiRecs
    .filter(r => r.stockCode === code)
    .sort((a, b) => aiModels.findIndex(m => m.model === a.aiModel) - aiModels.findIndex(m => m.model === b.aiModel));

  const newsInsights = analysis ? ([
    analysis.gemini_result && analysis.gemini_recommendation
      ? { bot: 'Gemini' as const, comment: analysis.gemini_result, signal: REC_LABEL[analysis.gemini_recommendation] ?? '중립' }
      : null,
    analysis.claude_result && analysis.claude_recommendation
      ? { bot: 'Claude' as const, comment: analysis.claude_result, signal: REC_LABEL[analysis.claude_recommendation] ?? '중립' }
      : null,
    analysis.clova_result && analysis.clova_recommendation
      ? { bot: 'CLOVA' as const, comment: analysis.clova_result, signal: REC_LABEL[analysis.clova_recommendation] ?? '중립' }
      : null,
  ] as const).filter((x): x is { bot: BotName; comment: string; signal: Signal } => x != null) : [];

  const cardStyle = { background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14 } as const;
  const sectionTitle = (text: string) => <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>{text}</div>;

  return <>
    {/* 오늘 등락 이유 */}
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>오늘 등락 이유</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: aiReason ? undefined : theme.textMuted }}>
        {aiReasonStatus === 'loading' ? 'AI가 오늘 뉴스와 시장 흐름을 읽고 있어요…' : aiReason?.reason ?? 'AI 분석 준비 중입니다'}
      </div>
      {aiReason && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: theme.textMuted }}>
          <AiIcon model={aiReason.ai_model} size={12} />
          {findAiProfile(aiModels, aiReason.ai_model).name} · {new Date(aiReason.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
        </div>
      )}
    </div>

    {/* AI 추천 (아직 결과가 나오지 않은 실제 추천) */}
    {stockRecs.length === 0 ? (
      <div style={{ ...cardStyle, fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>
        아직 이 종목을 추천한 AI가 없어요. AI 추천은 평일 장 마감 뒤(16시)에 새로 나옵니다.
      </div>
    ) : <>
      {(() => {
        const buyCount = stockRecs.filter(r => r.opinion === 'BUY').length;
        const sellCount = stockRecs.length - buyCount;
        // -1(전부 매도) ~ +1(전부 매수)
        const score = (buyCount - sellCount) / stockRecs.length;
        const pct = ((score + 1) / 2) * 100;
        const gaugeColor = score > 0.2 ? theme.up : score < -0.2 ? theme.down : theme.textMuted;
        const gaugeLabel = score > 0.2 ? '매수 우세' : score < -0.2 ? '매도 우세' : '의견 갈림';
        return (
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>AI 종합 의견</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: gaugeColor }}>{gaugeLabel}</div>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{
                height: 8, borderRadius: 99,
                background: `linear-gradient(to right, ${theme.down}, ${theme.textMuted} 50%, ${theme.up})`,
                opacity: 0.35,
              }} />
              <div style={{
                position: 'absolute', top: '50%', left: `${pct}%`,
                transform: 'translate(-50%, -50%)',
                width: 16, height: 16, borderRadius: '50%',
                background: gaugeColor, border: `3px solid ${theme.panel2}`, boxShadow: `0 0 0 2px ${gaugeColor}`,
                transition: 'left 0.4s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600 }}>
              <span style={{ color: theme.down }}>매도 {sellCount}</span>
              <span style={{ color: theme.textMuted }}>AI {stockRecs.length}개 추천</span>
              <span style={{ color: theme.up }}>매수 {buyCount}</span>
            </div>
          </div>
        );
      })()}

      {/* AI별 코멘트 (추천 이유와 실제 근거 뉴스) */}
      {sectionTitle('AI별 추천 코멘트')}
      {stockRecs.map(rec => {
        const signalColor = rec.opinion === 'BUY' ? theme.up : theme.down;
        return (
          <div key={rec.id} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AiIcon model={rec.aiModel} size={20} />
              <span style={{ fontSize: 12, fontWeight: 700 }}>{findAiProfile(aiModels, rec.aiModel).name}</span>
              <span style={{ fontSize: 10, color: theme.textMuted }}>{rec.periodType === 'WEEKLY' ? '1주' : '1달'} 추천</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: signalColor, border: `1px solid ${signalColor}`, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
                {rec.opinion === 'BUY' ? '매수' : '매도'}
              </span>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: theme.text }}>{rec.reason}</div>

            {rec.evidence.length > 0 && (
              <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, letterSpacing: '0.03em' }}>근거 뉴스</div>
                {rec.evidence.map((ev, i) => (
                  <a
                    key={i}
                    href={ev.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', flexDirection: 'column', gap: 1, textDecoration: 'none', color: 'inherit', cursor: ev.url ? 'pointer' : 'default' }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 500, color: theme.text, lineHeight: 1.4 }}>· {ev.title}</div>
                    <div style={{ fontSize: 10, color: theme.textMuted }}>
                      {ev.source} · {new Date(ev.publishedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>}

    {/* 뉴스 분석: 버튼을 누르면 각 AI가 이 종목 최신 뉴스를 읽고 의견을 낸다 */}
    {sectionTitle('AI 뉴스 분석')}
    <button
      type="button"
      onClick={onRun}
      disabled={analyzing}
      style={{
        border: `1px solid ${theme.border}`,
        background: theme.panel2,
        color: theme.text,
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 12,
        fontWeight: 700,
        cursor: analyzing ? 'wait' : 'pointer',
        opacity: analyzing ? 0.7 : 1,
      }}
    >
      {analyzing ? '뉴스 분석 중…' : analysis ? '뉴스 다시 분석' : '뉴스 분석하기'}
    </button>
    {error && <div style={{ fontSize: 12, color: theme.down }}>{error}</div>}

    {status === 'loading' && (
      <div style={{ ...cardStyle, color: theme.textMuted, fontSize: 13 }}>분석 결과를 불러오는 중…</div>
    )}
    {status === 'error' && (
      <div style={{ ...cardStyle, color: theme.textMuted, fontSize: 13 }}>분석 결과를 불러오지 못했습니다</div>
    )}
    {status === 'empty' && !analyzing && (
      <div style={{ ...cardStyle, color: theme.textMuted, fontSize: 13 }}>
        아직 분석 결과가 없습니다. 뉴스를 모아 AI가 요약·정리합니다.
      </div>
    )}

    {analysis && analysis.is_matched != null && newsInsights.length > 0 && (
      <div style={{ fontSize: 11, color: theme.textMuted }}>
        AI 의견 {analysis.is_matched ? '일치' : '불일치'} · {timeAgo(analysis.analyzed_at)} 분석
      </div>
    )}
    {newsInsights.map((ins) => {
      const signalColor = ins.signal === '매수' ? theme.up : ins.signal === '매도' ? theme.down : theme.textMuted;
      return (
        <div key={ins.bot} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: theme.aiSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              <img src={BOT_META[ins.bot].icon} alt={ins.bot} width={16} height={16} style={{ objectFit: 'contain' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{ins.bot}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: signalColor, border: `1px solid ${signalColor}`, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>{ins.signal}</span>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: theme.text }}>{ins.comment}</div>
          {analysis && analysis.related_news.length > 0 && (
            <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, letterSpacing: '0.03em' }}>근거 뉴스</div>
              {analysis.related_news.slice(0, 5).map((src) => (
                <div key={src.id} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: theme.text, lineHeight: 1.4 }}>· {src.title}</div>
                  <div style={{ fontSize: 10, color: theme.textMuted }}>{src.source ?? ''} · {timeAgo(src.published_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    })}

    {/* 같은 업종 종목 */}
    {similarStocks.length > 0 && <>
      {sectionTitle('같은 업종 종목')}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {similarStocks.map(s => (
          <div key={s.code} style={{ padding: '5px 10px', borderRadius: 20, border: `1px solid ${theme.border}`, fontSize: 12, color: theme.textMuted, cursor: 'pointer' }}
            onClick={() => navigate(`/stock/${s.code}`)}>
            {s.name}
          </div>
        ))}
      </div>
    </>}
  </>;
}

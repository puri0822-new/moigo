import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { stocks } from '../../data/mockData';
import { timeAgo } from '../../lib/time';
import type { ApiAiAnalysis } from '../../lib/api';
import { BOT_META, REC_LABEL, type BotName, type Signal } from './shared';

interface AiInsightTabProps {
  code: string | undefined;
  analysis: ApiAiAnalysis | null;
  status: 'loading' | 'ready' | 'empty' | 'error';
  analyzing: boolean;
  error: string | null;
  onRun: () => void;
}

// 우측 패널의 AI 인사이트 탭: 뉴스 분석 실행, 종합 의견 게이지, AI별 코멘트
export default function AiInsightTab({ code, analysis, status, analyzing, error, onRun }: AiInsightTabProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  // 유사 종목은 목업 데이터에 있는 종목만 표시된다
  const mockStock = stocks.find(s => s.code === code);

  const insights = analysis ? ([
    analysis.gemini_result && analysis.gemini_recommendation
      ? { bot: 'Gemini' as const, comment: analysis.gemini_result, signal: REC_LABEL[analysis.gemini_recommendation] ?? '중립' }
      : null,
    analysis.gpt_result && analysis.gpt_recommendation
      ? { bot: 'GPT' as const, comment: analysis.gpt_result, signal: REC_LABEL[analysis.gpt_recommendation] ?? '중립' }
      : null,
    analysis.clova_result && analysis.clova_recommendation
      ? { bot: 'CLOVA' as const, comment: analysis.clova_result, signal: REC_LABEL[analysis.clova_recommendation] ?? '중립' }
      : null,
  ] as const).filter((x): x is { bot: BotName; comment: string; signal: Signal } => x != null) : [];

  const buyCount = insights.filter(i => i.signal === '매수').length;
  const neutralCount = insights.filter(i => i.signal === '중립').length;
  const sellCount = insights.filter(i => i.signal === '매도').length;
  const total = insights.length;
  const score = total ? (buyCount - sellCount) / total : 0;
  const pct = ((score + 1) / 2) * 100;
  const gaugeColor = score > 0.2 ? theme.up : score < -0.2 ? theme.down : theme.textMuted;
  const gaugeLabel = score > 0.2 ? '매수 우세' : score < -0.2 ? '매도 우세' : '중립';

  return <>
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
      <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, color: theme.textMuted, fontSize: 13 }}>
        분석 결과를 불러오는 중…
      </div>
    )}
    {status === 'error' && (
      <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, color: theme.textMuted, fontSize: 13 }}>
        분석 결과를 불러오지 못했습니다
      </div>
    )}
    {status === 'empty' && !analyzing && (
      <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, color: theme.textMuted, fontSize: 13 }}>
        아직 분석 결과가 없습니다. 뉴스를 모아 AI가 요약·정리합니다.
      </div>
    )}

    {analysis && total > 0 && (
      <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            position: 'absolute',
            top: '50%',
            left: `${pct}%`,
            transform: 'translate(-50%, -50%)',
            width: 16, height: 16,
            borderRadius: '50%',
            background: gaugeColor,
            border: `3px solid ${theme.panel2}`,
            boxShadow: `0 0 0 2px ${gaugeColor}`,
            transition: 'left 0.4s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600 }}>
          <span style={{ color: theme.down }}>매도 {sellCount}</span>
          <span style={{ color: theme.textMuted }}>중립 {neutralCount}</span>
          <span style={{ color: theme.up }}>매수 {buyCount}</span>
        </div>
        {analysis.is_matched != null && (
          <div style={{ fontSize: 11, color: theme.textMuted }}>
            AI 의견 {analysis.is_matched ? '일치' : '불일치'}
          </div>
        )}
      </div>
    )}

    {insights.length > 0 && (
      <>
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>AI별 코멘트</div>
        {insights.map((ins) => {
          const signalColor = ins.signal === '매수' ? theme.up : ins.signal === '매도' ? theme.down : theme.textMuted;
          return (
            <div key={ins.bot} style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
      </>
    )}

    {/* 유사 종목 */}
    {mockStock && mockStock.similar.length > 0 && <>
      <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>유사 종목</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {mockStock.similar.map(name => (
          <div key={name} style={{ padding: '5px 10px', borderRadius: 20, border: `1px solid ${theme.border}`, fontSize: 12, color: theme.textMuted, cursor: 'pointer' }}
            onClick={() => { const s = stocks.find(s => s.name === name); if (s) navigate(`/stock/${s.code}`); }}>
            {name}
          </div>
        ))}
      </div>
    </>}
  </>;
}

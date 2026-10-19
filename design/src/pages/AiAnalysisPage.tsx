import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import StockLogo from '../components/StockLogo';
import HorizontalScroll from '../components/HorizontalScroll';
import AiIcon from '../components/AiIcon';
import AiStatsCard from '../components/AiStatsCard';
import AiHitRateTrendChart from '../components/AiHitRateTrendChart';
import AiRecommendationModal, { HitBadge, formatDate, formatReturn, resultLabel } from '../components/AiRecommendationModal';
import { AI_PAST_RECOMMENDATIONS, AI_RECOMMENDATIONS, hitRateOf } from '../data/aiRecommendations';
import type { AiRecommendation, PeriodType } from '../data/aiRecommendations';
import { useAiModels } from '../lib/aiModels';
import type { AiModel } from '../lib/aiModels';

type PeriodFilter = 'ALL' | PeriodType;
const PERIOD_FILTERS: [PeriodFilter, string][] = [['ALL', '전체'], ['WEEKLY', '주간'], ['MONTHLY', '월간']];

export default function AiAnalysisPage() {
  const { theme } = useTheme();
  const [period, setPeriod] = useState<PeriodFilter>('ALL');
  const [selected, setSelected] = useState<AiRecommendation | null>(null);
  const [pastAi, setPastAi] = useState<'ALL' | AiModel>('ALL');
  const models = useAiModels();
  // 새 추천과 성적 카드는 지금 쓰는 모델만, 성적표 필터는 지난 추천이 있는 모델(중단된 모델 포함)
  const activeModels = models.filter(m => m.isActive);
  const pastModels = models.filter(m => AI_PAST_RECOMMENDATIONS.some(r => r.aiModel === m.model));

  // 최근에 검증된 것부터
  const pastRecs = AI_PAST_RECOMMENDATIONS
    .filter(r => r.result && (period === 'ALL' || r.periodType === period) && (pastAi === 'ALL' || r.aiModel === pastAi))
    .sort((a, b) => b.result!.evaluatedAt.localeCompare(a.result!.evaluatedAt));

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* 소개 배너 */}
      <div style={{
        background: `linear-gradient(135deg, #4F6EF7 0%, #7B5EA7 60%, #3B4FC8 100%)`,
        borderRadius: 16, padding: '26px 32px',
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', right: 120, bottom: -70, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', marginBottom: 8 }}>
            ✦ AI 추천 성적표
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.45 }}>
            AI가 뉴스를 분석해 종목을 추천하고,<br />1주·1달 뒤 실제 결과로 성적을 공개합니다
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {['뉴스 수집·분석', '매수/매도 추천', '결과 검증'].map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {i > 0 && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>→</span>}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 20,
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                fontSize: 12, fontWeight: 600, color: '#fff',
              }}>
                <span style={{
                  width: 16, height: 16, borderRadius: '50%', background: '#fff', color: '#4F6EF7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800,
                }}>
                  {i + 1}
                </span>
                {step}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI별 성적 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {activeModels.map(ai => <AiStatsCard key={ai.model} ai={ai} onSelect={setSelected} />)}
      </div>
      <AiHitRateTrendChart />

      <div style={{ display: 'flex', gap: 6 }}>
        {PERIOD_FILTERS.map(([key, label]) => (
          <div
            key={key}
            onClick={() => setPeriod(key)}
            style={{
              fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
              background: period === key ? theme.ai : theme.panel2,
              color: period === key ? '#fff' : theme.textMuted,
              border: `1px solid ${period === key ? theme.ai : theme.border}`,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {activeModels.map(ai => {
        const recs = AI_RECOMMENDATIONS.filter(
          r => r.aiModel === ai.model && (period === 'ALL' || r.periodType === period),
        );
        const hitRate = hitRateOf(ai.model);
        return (
          <section key={ai.model} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AiIcon model={ai.model} size={26} />
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {ai.name}{' '}
                <span style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted }}>
                  적중률 <span style={{ color: ai.color }}>{hitRate == null ? '-' : `${Math.round(hitRate * 100)}%`}</span>
                </span>
              </div>
            </div>

            {recs.length === 0 ? (
              <div style={{
                background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14,
                padding: '28px 0', textAlign: 'center', fontSize: 13, color: theme.textMuted,
              }}>
                추천한 종목이 없습니다
              </div>
            ) : (
              <HorizontalScroll>
                {recs.map(r => {
                  const isBuy = r.opinion === 'BUY';
                  const opinionColor = isBuy ? theme.up : theme.down;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelected(r)}
                      style={{
                        width: 220, flexShrink: 0, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', gap: 10,
                        background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14,
                        padding: 16,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <StockLogo name={r.stockName} code={r.stockCode} size={32} />
                        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{r.stockName}</div>
                          <span style={{
                            padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                            color: theme.ai, background: theme.aiSoft,
                          }}>
                            {r.sector}
                          </span>
                        </div>
                        <span style={{
                          marginLeft: 'auto', flexShrink: 0,
                          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                          color: opinionColor, border: `1px solid ${opinionColor}`,
                        }}>
                          {isBuy ? '매수' : '매도'}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 12, color: theme.textMuted, lineHeight: 1.5,
                        // 긴 요약은 두 줄까지만 보여주고, 전체는 상세 창에서 본다
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {r.reason}
                      </div>
                      <div style={{ marginTop: 'auto', fontSize: 12, color: theme.textMuted }}>
                        추천가 <span style={{ color: theme.text, fontWeight: 700 }}>{r.priceAtRecommendation.toLocaleString()}원</span>
                      </div>
                      <div style={{
                        paddingTop: 10, borderTop: `1px solid ${theme.border}`,
                        fontSize: 11, color: theme.textMuted,
                      }}>
                        {r.periodType === 'WEEKLY' ? '1주' : '1달'} 추천 ·{' '}
                        <span style={{ color: theme.ai, fontWeight: 700 }}>{resultLabel(r.evaluateAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </HorizontalScroll>
            )}
          </section>
        );
      })}

      {/* 지난 추천 성적표 */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>지난 추천 성적표</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {([['ALL', '전체'], ...pastModels.map(p => [p.model, p.name])] as ['ALL' | AiModel, string][]).map(([key, label]) => {
              const active = pastAi === key;
              return (
                <div
                  key={key}
                  onClick={() => setPastAi(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                    background: active ? theme.ai : theme.panel2,
                    color: active ? '#fff' : theme.textMuted,
                    border: `1px solid ${active ? theme.ai : theme.border}`,
                  }}
                >
                  {key !== 'ALL' && <AiIcon model={key} size={13} />}
                  {label}
                </div>
              );
            })}
          </div>
        </div>
        {pastRecs.length === 0 ? (
          <div style={{
            background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14,
            padding: '28px 0', textAlign: 'center', fontSize: 13, color: theme.textMuted,
          }}>
            아직 검증된 추천이 없습니다
          </div>
        ) : (
          <div style={{
            background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14,
            overflow: 'hidden',
          }}>
            {pastRecs.map((r, i) => {
              const result = r.result!;
              const isBuy = r.opinion === 'BUY';
              return (
                <div
                  key={r.id}
                  onClick={() => setSelected(r)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer',
                    borderTop: i === 0 ? 'none' : `1px solid ${theme.border}`,
                  }}
                >
                  <AiIcon model={r.aiModel} size={18} />
                  <StockLogo name={r.stockName} code={r.stockCode} size={30} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{r.stockName}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isBuy ? theme.up : theme.down }}>
                        {isBuy ? '매수' : '매도'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                      {r.periodType === 'WEEKLY' ? '1주' : '1달'} 추천 · {formatDate(r.recommendedAt)} → {formatDate(result.evaluatedAt)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: result.returnRate >= 0 ? theme.up : theme.down }}>
                      {formatReturn(result.returnRate)}
                    </div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                      {r.priceAtRecommendation.toLocaleString()} → {result.priceAtEvaluation.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ width: 44, display: 'flex', justifyContent: 'flex-end' }}>
                    <HitBadge isHit={result.isHit} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {selected && <AiRecommendationModal rec={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

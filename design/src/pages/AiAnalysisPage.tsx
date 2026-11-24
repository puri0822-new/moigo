import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import StockLogo from '../components/StockLogo';
import HorizontalScroll from '../components/HorizontalScroll';
import AiIcon from '../components/AiIcon';
import AiStatsCard from '../components/AiStatsCard';
import AiHitRateTrendChart from '../components/AiHitRateTrendChart';
import AiConsensusPanel from '../components/AiConsensusPanel';
import AiRecommendationModal, { HitBadge, formatDate, formatReturn, resultLabel } from '../components/AiRecommendationModal';
import { directionalReturn, hitRateOf, useAiRecommendations } from '../lib/aiRecommendations';
import type { AiRecommendation, PeriodType } from '../lib/aiRecommendations';
import { useAiModels } from '../lib/aiModels';
import type { AiModel } from '../lib/aiModels';
import { useViewport } from '../lib/useViewport';
import { FS, FW, RADIUS, BRAND_GRADIENT } from '../lib/tokens';
import Pressable from '../components/Pressable';

type PeriodFilter = 'ALL' | PeriodType;
const PERIOD_FILTERS: [PeriodFilter, string][] = [['ALL', '전체'], ['WEEKLY', '주간'], ['MONTHLY', '월간']];
// 지난 추천 성적표를 한 번에 보여주는 개수 (더보기를 누를 때마다 이만큼 늘어난다)
const PAST_PAGE_SIZE = 10;

export default function AiAnalysisPage() {
  const { theme } = useTheme();
  const { isMobile } = useViewport();
  const [period, setPeriod] = useState<PeriodFilter>('ALL');
  const [selected, setSelected] = useState<AiRecommendation | null>(null);
  const [pastAi, setPastAi] = useState<'ALL' | AiModel>('ALL');
  const [pastLimit, setPastLimit] = useState(PAST_PAGE_SIZE);
  const models = useAiModels();
  const { status, current, past } = useAiRecommendations();
  // 새 추천과 성적 카드는 지금 쓰는 모델만, 성적표 필터는 지난 추천이 있는 모델(중단된 모델 포함)
  const activeModels = models.filter(m => m.isActive);
  const pastModels = models.filter(m => past.some(r => r.aiModel === m.model));

  // 최근에 검증된 것부터
  const pastRecs = past
    .filter(r => r.result && (period === 'ALL' || r.periodType === period) && (pastAi === 'ALL' || r.aiModel === pastAi))
    .sort((a, b) => b.result!.evaluatedAt.localeCompare(a.result!.evaluatedAt));
  const pastRemaining = pastRecs.length - pastLimit;

  // 필터를 바꾸면 다시 처음 10개부터 보여준다
  useEffect(() => setPastLimit(PAST_PAGE_SIZE), [period, pastAi]);

  return (
    <div style={{ padding: isMobile ? 16 : 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 소개 배너 */}
      <div style={{
        background: BRAND_GRADIENT,
        borderRadius: RADIUS.xl, padding: isMobile ? '24px 20px' : '24px 32px',
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', right: 120, bottom: -70, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'relative', flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: FS.caption, fontWeight: FW.medium, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', marginBottom: 8 }}>
              ✦ AI 추천 성적표
            </div>
            <div style={{ fontSize: isMobile ? FS.title : FS.heading, fontWeight: FW.bold, color: '#fff', lineHeight: 1.45 }}>
              AI가 뉴스를 분석해 종목을 추천하고,<br />1주·1달 뒤 실제 결과로 성적을 공개합니다
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {['뉴스 수집·분석', '매수/매도 추천', '결과 검증'].map((step, i) => (
              <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {i > 0 && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: FS.caption }}>→</span>}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: RADIUS.pill,
                  background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                  fontSize: FS.caption, fontWeight: FW.medium, color: '#fff',
                }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%', background: '#fff', color: '#4361ee',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.caption, fontWeight: FW.bold,
                  }}>
                    {i + 1}
                  </span>
                  {step}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 여러 AI가 함께 고른 종목 (없으면 AI별 주목 종목) */}
        <AiConsensusPanel current={current} />
      </div>

      {status !== 'ready' && (
        <div style={{ fontSize: FS.body, color: theme.textMuted }}>
          {status === 'loading' ? 'AI 추천을 불러오는 중…' : 'AI 추천을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.'}
        </div>
      )}
      {status === 'ready' && current.length === 0 && past.length === 0 && (
        <div style={{
          background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: RADIUS.lg,
          padding: '24px', fontSize: FS.body, color: theme.textMuted, lineHeight: 1.6, textAlign: 'center',
        }}>
          아직 AI 추천이 없습니다. 평일 장 마감 뒤(16시)에 AI가 그날 뉴스를 분석해 첫 추천을 올립니다.
        </div>
      )}

      {/* AI별 성적 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {activeModels.map(ai => <AiStatsCard key={ai.model} ai={ai} onSelect={setSelected} />)}
      </div>
      {past.length > 0 ? <AiHitRateTrendChart /> : status === 'ready' && current.length > 0 && (
        <div style={{
          background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: RADIUS.lg,
          padding: '20px 24px', fontSize: FS.body, color: theme.textMuted, lineHeight: 1.6,
        }}>
          아직 검증이 끝난 추천이 없어 적중률 추이가 없습니다. 첫 결과는{' '}
          <b style={{ color: theme.text }}>{formatDate(current.reduce((min, r) => (r.evaluateAt < min ? r.evaluateAt : min), current[0].evaluateAt))}</b>에 나옵니다.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PERIOD_FILTERS.map(([key, label]) => (
          <Pressable
            key={key}
            onClick={() => setPeriod(key)}
            style={{
              fontSize: FS.body, fontWeight: FW.medium, padding: '8px 16px', borderRadius: RADIUS.pill, cursor: 'pointer',
              background: period === key ? theme.ai : theme.panel2,
              color: period === key ? '#fff' : theme.textMuted,
              border: `1px solid ${period === key ? theme.ai : theme.border}`,
            }}
          >
            {label}
          </Pressable>
        ))}
      </div>

      {activeModels.map(ai => {
        const recs = current.filter(
          r => r.aiModel === ai.model && (period === 'ALL' || r.periodType === period),
        );
        const hitRate = hitRateOf(past, ai.model);
        return (
          <section key={ai.model} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <AiIcon model={ai.model} size={26} />
              <div style={{ fontSize: FS.title, fontWeight: FW.semibold }}>
                {ai.name}{' '}
                <span style={{ fontSize: FS.body, fontWeight: FW.medium, color: theme.textMuted }}>
                  적중률 <span style={{ color: ai.color }}>{hitRate == null ? '-' : `${Math.round(hitRate * 100)}%`}</span>
                </span>
              </div>
            </div>

            {recs.length === 0 ? (
              <div style={{
                background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: RADIUS.lg,
                padding: '32px 0', textAlign: 'center', fontSize: FS.body, color: theme.textMuted,
              }}>
                추천한 종목이 없습니다
              </div>
            ) : (
              <HorizontalScroll>
                {recs.map(r => {
                  const isBuy = r.opinion === 'BUY';
                  const opinionColor = isBuy ? theme.up : theme.down;
                  return (
                    <Pressable
                      key={r.id}
                      onClick={() => setSelected(r)}
                      style={{
                        width: 220, flexShrink: 0, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', gap: 12,
                        background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: RADIUS.lg,
                        padding: 16,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <StockLogo name={r.stockName} code={r.stockCode} size={32} />
                        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                          <div style={{ fontSize: FS.body, fontWeight: FW.semibold }}>{r.stockName}</div>
                          <span style={{
                            padding: '2px 8px', borderRadius: RADIUS.md, fontSize: FS.caption, fontWeight: FW.medium,
                            color: theme.aiFg, background: theme.aiSoft,
                          }}>
                            {r.sector}
                          </span>
                        </div>
                        <span style={{
                          marginLeft: 'auto', flexShrink: 0,
                          padding: '4px 8px', borderRadius: RADIUS.md, fontSize: FS.caption, fontWeight: FW.semibold,
                          color: opinionColor, border: `1px solid ${opinionColor}`,
                        }}>
                          {isBuy ? '매수' : '매도'}
                        </span>
                      </div>
                      <div style={{
                        fontSize: FS.caption, color: theme.textMuted, lineHeight: 1.5,
                        // 긴 요약은 두 줄까지만 보여주고, 전체는 상세 창에서 본다
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {r.reason}
                      </div>
                      <div style={{ marginTop: 'auto', fontSize: FS.caption, color: theme.textMuted }}>
                        추천가 <span style={{ color: theme.text, fontWeight: FW.semibold }}>{r.priceAtRecommendation.toLocaleString()}원</span>
                        {/* 중간 집계: 추천 후 지금까지의 가격 변화와, 추천 방향대로 가고 있는지 */}
                        {r.live && (
                          <div style={{ marginTop: 4 }}>
                            현재 <span style={{ color: theme.text, fontWeight: FW.semibold }}>{r.live.price.toLocaleString()}원</span>{' '}
                            <span style={{ fontWeight: FW.semibold, color: r.live.returnRate >= 0 ? theme.up : theme.down }}>({formatReturn(r.live.returnRate)})</span>
                          </div>
                        )}
                      </div>
                      <div style={{
                        paddingTop: 12, borderTop: `1px solid ${theme.border}`,
                        fontSize: FS.caption, color: theme.textMuted,
                      }}>
                        {r.periodType === 'WEEKLY' ? '1주' : '1달'} 추천 ·{' '}
                        <span style={{ color: theme.aiFg, fontWeight: FW.semibold }}>{resultLabel(r.evaluateAt)}</span>
                        {r.live && (
                          <span style={{
                            float: 'right', fontSize: FS.caption, fontWeight: FW.semibold, borderRadius: RADIUS.sm, padding: '2px 4px', whiteSpace: 'nowrap',
                            color: directionalReturn(r) > 0 ? theme.success : theme.error,
                            background: directionalReturn(r) > 0 ? theme.successSoft : theme.errorSoft,
                          }}>
                            {directionalReturn(r) > 0 ? '맞히는 중' : '빗나가는 중'}
                          </span>
                        )}
                      </div>
                    </Pressable>
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
          <div style={{ fontSize: FS.title, fontWeight: FW.semibold }}>지난 추천 성적표</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {([['ALL', '전체'], ...pastModels.map(p => [p.model, p.name])] as ['ALL' | AiModel, string][]).map(([key, label]) => {
              const active = pastAi === key;
              return (
                <Pressable
                  key={key}
                  onClick={() => setPastAi(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: FS.caption, fontWeight: FW.medium, padding: '4px 12px', borderRadius: RADIUS.pill, cursor: 'pointer',
                    background: active ? theme.ai : theme.panel2,
                    color: active ? '#fff' : theme.textMuted,
                    border: `1px solid ${active ? theme.ai : theme.border}`,
                  }}
                >
                  {key !== 'ALL' && <AiIcon model={key} size={13} />}
                  {label}
                </Pressable>
              );
            })}
          </div>
        </div>
        {pastRecs.length === 0 ? (
          <div style={{
            background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: RADIUS.lg,
            padding: '32px 0', textAlign: 'center', fontSize: FS.body, color: theme.textMuted,
          }}>
            아직 검증된 추천이 없습니다
          </div>
        ) : (
          <div style={{
            background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: RADIUS.lg,
            overflow: 'hidden',
          }}>
            {pastRecs.slice(0, pastLimit).map((r, i) => {
              const result = r.result!;
              const isBuy = r.opinion === 'BUY';
              return (
                <Pressable
                  key={r.id}
                  onClick={() => setSelected(r)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: 16, cursor: 'pointer',
                    borderTop: i === 0 ? 'none' : `1px solid ${theme.border}`,
                  }}
                >
                  <AiIcon model={r.aiModel} size={18} />
                  <StockLogo name={r.stockName} code={r.stockCode} size={30} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: FS.body, fontWeight: FW.semibold }}>{r.stockName}</span>
                      <span style={{ fontSize: FS.caption, fontWeight: FW.semibold, color: isBuy ? theme.up : theme.down }}>
                        {isBuy ? '매수' : '매도'}
                      </span>
                    </div>
                    <div style={{ fontSize: FS.caption, color: theme.textMuted, marginTop: 2 }}>
                      {r.periodType === 'WEEKLY' ? '1주' : '1달'} 추천 · {formatDate(r.recommendedAt)} → {formatDate(result.evaluatedAt)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: FS.body, fontWeight: FW.bold, color: result.returnRate >= 0 ? theme.up : theme.down }}>
                      {formatReturn(result.returnRate)}
                    </div>
                    <div style={{ fontSize: FS.caption, color: theme.textMuted, marginTop: 2 }}>
                      {r.priceAtRecommendation.toLocaleString()} → {result.priceAtEvaluation.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ width: 44, display: 'flex', justifyContent: 'flex-end' }}>
                    <HitBadge isHit={result.isHit} />
                  </div>
                </Pressable>
              );
            })}
            {pastRemaining > 0 && (
              <Pressable
                onClick={() => setPastLimit(n => n + PAST_PAGE_SIZE)}
                style={{
                  padding: '12px 0', textAlign: 'center', cursor: 'pointer',
                  fontSize: FS.body, fontWeight: FW.medium, color: theme.textMuted,
                  borderTop: `1px solid ${theme.border}`,
                }}
              >
                더보기 ({pastRemaining}개 남음)
              </Pressable>
            )}
          </div>
        )}
      </section>

      {selected && <AiRecommendationModal rec={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

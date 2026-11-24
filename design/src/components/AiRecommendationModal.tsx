import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import StockLogo from './StockLogo';
import AiIcon from './AiIcon';
import { daysUntil } from '../lib/time';
import { findAiProfile, useAiModels } from '../lib/aiModels';
import type { AiRecommendation } from '../lib/aiRecommendations';
import { FS, FW, RADIUS } from '../lib/tokens';
import Pressable from './Pressable';

// 검증일이 지났는데 결과가 아직 없으면(검증 작업 대기 중) '결과 집계 중'으로 보여준다
export function resultLabel(evaluateAt: string): string {
  const days = daysUntil(evaluateAt);
  if (days > 0) return `결과 공개 D-${days}`;
  if (days === 0) return '오늘 결과 공개';
  return '결과 집계 중';
}

export function formatReturn(rate: number): string {
  return `${rate >= 0 ? '+' : ''}${(rate * 100).toFixed(2)}%`;
}

export function formatDate(dateString: string): string {
  const d = new Date(dateString);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

export function HitBadge({ isHit }: { isHit: boolean }) {
  const { theme } = useTheme();
  const color = isHit ? theme.success : theme.error;
  return (
    <span style={{
      flexShrink: 0, padding: '4px 8px', borderRadius: RADIUS.pill, fontSize: FS.caption, fontWeight: FW.semibold,
      color, background: isHit ? theme.successSoft : theme.errorSoft,
    }}>
      {isHit ? '적중' : '실패'}
    </span>
  );
}

interface AiRecommendationModalProps {
  rec: AiRecommendation;
  onClose: () => void;
}

export default function AiRecommendationModal({ rec, onClose }: AiRecommendationModalProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const ai = findAiProfile(useAiModels(), rec.aiModel);
  const isBuy = rec.opinion === 'BUY';
  const opinionColor = isBuy ? theme.up : theme.down;
  const result = rec.result;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sectionTitle = (text: string) => (
    <div style={{ fontSize: FS.caption, fontWeight: FW.semibold, color: theme.textMuted }}>{text}</div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, maxHeight: 'calc(100vh - 48px)', margin: '0 24px', overflowY: 'auto',
          background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: RADIUS.xl, padding: 24,
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        {/* 종목 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <StockLogo name={rec.stockName} code={rec.stockCode} size={44} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <div style={{ fontSize: FS.title, fontWeight: FW.bold }}>{rec.stockName}</div>
            <span style={{
              padding: '2px 8px', borderRadius: RADIUS.md, fontSize: FS.caption, fontWeight: FW.medium,
              color: theme.aiFg, background: theme.aiSoft,
            }}>
              {rec.sector}
            </span>
          </div>
          <span style={{
            marginLeft: 'auto', flexShrink: 0,
            padding: '4px 12px', borderRadius: RADIUS.md, fontSize: FS.caption, fontWeight: FW.semibold,
            color: opinionColor, border: `1px solid ${opinionColor}`,
          }}>
            {isBuy ? '매수' : '매도'}
          </span>
          <Pressable
            onClick={onClose}
            aria-label="닫기"
            style={{ flexShrink: 0, cursor: 'pointer', color: theme.textMuted, fontSize: FS.title, lineHeight: '26px', padding: '0 8px' }}
          >
            ✕
          </Pressable>
        </div>

        {/* AI 추천 요약 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AiIcon model={rec.aiModel} size={16} />
            {sectionTitle(`${ai.name}의 추천 이유`)}
          </div>
          <div style={{
            padding: '16px 16px', borderRadius: RADIUS.lg,
            background: theme.aiSoft, borderLeft: `3px solid ${ai.color}`,
            fontSize: FS.body, fontWeight: FW.medium, lineHeight: 1.6,
          }}>
            {rec.reason}
          </div>
        </div>

        {/* 검증 결과: 검증이 끝난 추천만 */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sectionTitle('검증 결과')}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', borderRadius: RADIUS.lg,
              background: theme.panel2, border: `1px solid ${theme.border}`,
            }}>
              <HitBadge isHit={result.isHit} />
              <div style={{ fontSize: FS.body, color: theme.textMuted }}>
                {rec.priceAtRecommendation.toLocaleString()}원 → {result.priceAtEvaluation.toLocaleString()}원
              </div>
              <div style={{
                marginLeft: 'auto', fontSize: FS.title, fontWeight: FW.bold,
                color: result.returnRate >= 0 ? theme.up : theme.down,
              }}>
                {formatReturn(result.returnRate)}
              </div>
            </div>
            {!result.isHit && result.failureReason && (
              <div style={{
                padding: '12px 16px', borderRadius: RADIUS.lg,
                background: theme.errorSoft, borderLeft: `3px solid ${theme.error}`,
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ fontSize: FS.caption, fontWeight: FW.semibold, color: theme.error }}>
                  {ai.name}가 분석한 실패 원인
                </div>
                <div style={{ fontSize: FS.body, lineHeight: 1.6 }}>{result.failureReason}</div>
              </div>
            )}
          </div>
        )}

        {/* 근거 뉴스 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sectionTitle(`분석 근거 · 뉴스 ${rec.evidence.length}건`)}
          {rec.evidence.map((ev, i) => {
            const body = (
              <>
                <div style={{ fontSize: FS.caption, color: theme.textMuted }}>
                  {ev.source} · {formatDate(ev.publishedAt)}
                </div>
                <div style={{ fontSize: FS.body, fontWeight: FW.semibold, lineHeight: 1.45 }}>{ev.title}</div>
                <div style={{ fontSize: FS.caption, color: theme.textMuted, lineHeight: 1.5 }}>
                  <span style={{ color: theme.aiFg, fontWeight: FW.semibold }}>→ </span>{ev.insight}
                </div>
              </>
            );
            const boxStyle = {
              display: 'flex', flexDirection: 'column' as const, gap: 4,
              padding: '12px 16px', borderRadius: RADIUS.lg,
              background: theme.panel2, border: `1px solid ${theme.border}`,
            };
            // 원문 링크가 있으면 새 탭으로 연다
            return ev.url ? (
              <a key={i} href={ev.url} target="_blank" rel="noreferrer" style={boxStyle}>{body}</a>
            ) : (
              <div key={i} style={boxStyle}>{body}</div>
            );
          })}
        </div>

        {/* 추천 정보 */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
          paddingTop: 16, borderTop: `1px solid ${theme.border}`,
        }}>
          {[
            { label: '추천가', value: `${rec.priceAtRecommendation.toLocaleString()}원` },
            { label: '추천일', value: formatDate(rec.recommendedAt) },
            result
              ? { label: '검증일', value: formatDate(result.evaluatedAt) }
              : { label: rec.periodType === 'WEEKLY' ? '1주 추천' : '1달 추천', value: resultLabel(rec.evaluateAt), accent: true },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: FS.caption, color: theme.textMuted }}>{item.label}</div>
              <div style={{ fontSize: FS.body, fontWeight: FW.semibold, marginTop: 4, color: item.accent ? theme.aiFg : theme.text }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <Pressable
          onClick={() => navigate(`/stock/${rec.stockCode}`)}
          style={{
            padding: '12px 0', borderRadius: RADIUS.lg, cursor: 'pointer', textAlign: 'center',
            background: theme.ai, color: '#fff', fontSize: FS.body, fontWeight: FW.semibold,
          }}
        >
          종목 상세 보기
        </Pressable>
      </div>
    </div>
  );
}

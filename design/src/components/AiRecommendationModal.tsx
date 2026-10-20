import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import StockLogo from './StockLogo';
import AiIcon from './AiIcon';
import { daysUntil } from '../lib/time';
import { findAiProfile, useAiModels } from '../lib/aiModels';
import type { AiRecommendation } from '../lib/aiRecommendations';

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
  const color = isHit ? '#16a34a' : '#ef4444';
  return (
    <span style={{
      flexShrink: 0, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      color, background: isHit ? 'rgba(22, 163, 74, 0.12)' : 'rgba(239, 68, 68, 0.12)',
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
    <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>{text}</div>
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
          borderRadius: 20, padding: 24,
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        {/* 종목 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <StockLogo name={rec.stockName} code={rec.stockCode} size={44} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{rec.stockName}</div>
            <span style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              color: theme.ai, background: theme.aiSoft,
            }}>
              {rec.sector}
            </span>
          </div>
          <span style={{
            marginLeft: 'auto', flexShrink: 0,
            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
            color: opinionColor, border: `1px solid ${opinionColor}`,
          }}>
            {isBuy ? '매수' : '매도'}
          </span>
          <div
            onClick={onClose}
            style={{ flexShrink: 0, cursor: 'pointer', color: theme.textMuted, fontSize: 16, lineHeight: '26px' }}
          >
            ✕
          </div>
        </div>

        {/* AI 추천 요약 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AiIcon model={rec.aiModel} size={16} />
            {sectionTitle(`${ai.name}의 추천 이유`)}
          </div>
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: theme.aiSoft, borderLeft: `3px solid ${ai.color}`,
            fontSize: 14, fontWeight: 600, lineHeight: 1.6,
          }}>
            {rec.reason}
          </div>
        </div>

        {/* 검증 결과: 검증이 끝난 추천만 */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sectionTitle('검증 결과')}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', borderRadius: 12,
              background: theme.panel2, border: `1px solid ${theme.border}`,
            }}>
              <HitBadge isHit={result.isHit} />
              <div style={{ fontSize: 13, color: theme.textMuted }}>
                {rec.priceAtRecommendation.toLocaleString()}원 → {result.priceAtEvaluation.toLocaleString()}원
              </div>
              <div style={{
                marginLeft: 'auto', fontSize: 15, fontWeight: 800,
                color: result.returnRate >= 0 ? theme.up : theme.down,
              }}>
                {formatReturn(result.returnRate)}
              </div>
            </div>
            {!result.isHit && result.failureReason && (
              <div style={{
                padding: '12px 16px', borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.08)', borderLeft: '3px solid #ef4444',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>
                  {ai.name}가 분석한 실패 원인
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>{result.failureReason}</div>
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
                <div style={{ fontSize: 11, color: theme.textMuted }}>
                  {ev.source} · {formatDate(ev.publishedAt)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.45 }}>{ev.title}</div>
                <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.5 }}>
                  <span style={{ color: theme.ai, fontWeight: 700 }}>→ </span>{ev.insight}
                </div>
              </>
            );
            const boxStyle = {
              display: 'flex', flexDirection: 'column' as const, gap: 5,
              padding: '12px 14px', borderRadius: 12,
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
              <div style={{ fontSize: 11, color: theme.textMuted }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3, color: item.accent ? theme.ai : theme.text }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div
          onClick={() => navigate(`/stock/${rec.stockCode}`)}
          style={{
            padding: '12px 0', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
            background: theme.ai, color: '#fff', fontSize: 14, fontWeight: 700,
          }}
        >
          종목 상세 보기
        </div>
      </div>
    </div>
  );
}

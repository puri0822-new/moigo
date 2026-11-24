import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import AiIcon from './AiIcon';
import StockLogo from './StockLogo';
import { formatDate, formatReturn } from './AiRecommendationModal';
import { directionalReturn, liveStatsOf, statsOf, useAiRecommendations } from '../lib/aiRecommendations';
import type { AiRecommendation } from '../lib/aiRecommendations';
import type { AiProfile } from '../lib/aiModels';
import { FS, FW, RADIUS } from '../lib/tokens';
import Pressable from './Pressable';

// 적중률 하나를 보여주는 원형 그래프
function HitRing({ rate, color }: { rate: number | null; color: string }) {
  const { theme } = useTheme();
  const size = 76, stroke = 8, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={theme.panel2} strokeWidth={stroke} />
        {rate != null && rate > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${circ * rate} ${circ}`}
          />
        )}
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: FS.title, fontWeight: FW.bold,
      }}>
        {rate == null ? '-' : `${Math.round(rate * 100)}%`}
      </div>
    </div>
  );
}

interface AiStatsCardProps {
  ai: AiProfile;
  onSelect: (rec: AiRecommendation) => void;
}

export default function AiStatsCard({ ai, onSelect }: AiStatsCardProps) {
  const { theme } = useTheme();
  const { past, current } = useAiRecommendations();
  const stats = statsOf(past, ai.model);
  // 정식 채점 결과가 아직 없으면, 결과가 나오기 전 추천을 지금 가격으로 본 중간 집계를 보여준다
  const live = liveStatsOf(current, ai.model);
  const showLive = stats.total === 0 && live.total > 0;
  const rate = showLive ? live.winning / live.total : stats.total ? stats.hits / stats.total : null;
  const best = showLive ? live.best : stats.best;
  const [hovered, setHovered] = useState<AiRecommendation | null>(null);

  return (
    <div style={{
      flex: 1, minWidth: 260,
      background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: RADIUS.lg,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AiIcon model={ai.model} size={20} />
        <div style={{ fontSize: FS.title, fontWeight: FW.semibold }}>{ai.name}</div>
        {showLive && (
          <span
            title="1주·1달 뒤 정식 채점 전, 추천 후 지금까지의 가격 변화로 본 중간 집계입니다"
            style={{ marginLeft: 'auto', fontSize: FS.caption, fontWeight: FW.semibold, color: theme.aiFg, background: theme.aiSoft, borderRadius: RADIUS.pill, padding: '4px 8px' }}
          >
            중간 집계 · 실시간
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <HitRing rate={rate} color={ai.color} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {showLive ? (
            <div style={{ fontSize: FS.body, color: theme.textMuted }}>
              진행 중 <span style={{ color: theme.text, fontWeight: FW.semibold }}>{live.total}건</span> 중{' '}
              <span style={{ color: theme.text, fontWeight: FW.semibold }}>{live.winning}건</span> 맞히는 중
            </div>
          ) : (
            <div style={{ fontSize: FS.body, color: theme.textMuted }}>
              <span style={{ color: theme.text, fontWeight: FW.semibold }}>{stats.total}건</span> 중{' '}
              <span style={{ color: theme.text, fontWeight: FW.semibold }}>{stats.hits}건</span> 적중
            </div>
          )}
          <div style={{ fontSize: FS.body, color: theme.textMuted }}>
            {showLive ? '현재 평균 수익' : '평균 수익'}{' '}
            <span style={{ fontWeight: FW.semibold, color: (showLive ? live.avgReturn : stats.avgReturn) >= 0 ? theme.up : theme.down }}>
              {showLive ? formatReturn(live.avgReturn) : stats.total ? formatReturn(stats.avgReturn) : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* 최근 결과: 오래된 것부터 오른쪽으로. 색과 함께 ✓/✕로 구분한다 */}
      {stats.recent.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
          <div style={{ fontSize: FS.caption, color: theme.textMuted }}>최근 결과</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {stats.recent.map(r => {
              const hit = r.result!.isHit;
              return (
                <Pressable
                  key={r.id}
                  onClick={() => onSelect(r)}
                  onMouseEnter={() => setHovered(r)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    width: 22, height: 22, borderRadius: RADIUS.sm, cursor: 'pointer',
                    background: hit ? theme.success : theme.error, color: theme.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: FS.caption, fontWeight: FW.bold,
                    outline: hovered?.id === r.id ? `2px solid ${theme.text}` : 'none', outlineOffset: 1,
                  }}
                >
                  {hit ? '✓' : '✕'}
                </Pressable>
              );
            })}
          </div>
          {hovered && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 5, whiteSpace: 'nowrap',
              background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: RADIUS.md,
              boxShadow: '0 6px 18px rgba(0,0,0,.2)', padding: '8px 12px', fontSize: FS.caption,
            }}>
              <span style={{ fontWeight: FW.semibold }}>{hovered.stockName}</span>
              <span style={{ color: theme.textMuted }}>
                {' '}· {hovered.opinion === 'BUY' ? '매수' : '매도'} · {formatDate(hovered.result!.evaluatedAt)} 검증 ·{' '}
              </span>
              <span style={{ fontWeight: FW.semibold, color: hovered.result!.returnRate >= 0 ? theme.up : theme.down }}>
                {formatReturn(hovered.result!.returnRate)}
              </span>
            </div>
          )}
        </div>
      )}

      {best && (
        <Pressable
          onClick={() => onSelect(best)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            padding: '12px 12px', borderRadius: RADIUS.md, background: theme.panel2,
          }}
        >
          <span style={{ fontSize: FS.title }}>🏆</span>
          <StockLogo name={best.stockName} code={best.stockCode} size={24} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: FS.caption, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {showLive ? '현재 베스트' : '베스트 적중'}
            </div>
            <div style={{ fontSize: FS.body, fontWeight: FW.semibold }}>
              {best.stockName}{' '}
              <span style={{ fontSize: FS.caption, color: theme.textMuted, fontWeight: FW.medium }}>
                {best.opinion === 'BUY' ? '매수' : '매도'}
              </span>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: FS.body, fontWeight: FW.bold, color: theme.success }}>
            {formatReturn(directionalReturn(best))}
          </div>
        </Pressable>
      )}
    </div>
  );
}

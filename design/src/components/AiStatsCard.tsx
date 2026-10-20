import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import AiIcon from './AiIcon';
import StockLogo from './StockLogo';
import { formatDate, formatReturn } from './AiRecommendationModal';
import { directionalReturn, liveStatsOf, statsOf, useAiRecommendations } from '../lib/aiRecommendations';
import type { AiRecommendation } from '../lib/aiRecommendations';
import type { AiProfile } from '../lib/aiModels';

const HIT_COLOR = '#16a34a';
const MISS_COLOR = '#ef4444';

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
        fontSize: 18, fontWeight: 800,
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
      background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14,
      padding: 18, display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AiIcon model={ai.model} size={20} />
        <div style={{ fontSize: 15, fontWeight: 700 }}>{ai.name}</div>
        {showLive && (
          <span
            title="1주·1달 뒤 정식 채점 전, 추천 후 지금까지의 가격 변화로 본 중간 집계입니다"
            style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: theme.ai, background: theme.aiSoft, borderRadius: 999, padding: '3px 9px' }}
          >
            중간 집계 · 실시간
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <HitRing rate={rate} color={ai.color} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {showLive ? (
            <div style={{ fontSize: 13, color: theme.textMuted }}>
              진행 중 <span style={{ color: theme.text, fontWeight: 700 }}>{live.total}건</span> 중{' '}
              <span style={{ color: theme.text, fontWeight: 700 }}>{live.winning}건</span> 맞히는 중
            </div>
          ) : (
            <div style={{ fontSize: 13, color: theme.textMuted }}>
              <span style={{ color: theme.text, fontWeight: 700 }}>{stats.total}건</span> 중{' '}
              <span style={{ color: theme.text, fontWeight: 700 }}>{stats.hits}건</span> 적중
            </div>
          )}
          <div style={{ fontSize: 13, color: theme.textMuted }}>
            {showLive ? '현재 평균 수익' : '평균 수익'}{' '}
            <span style={{ fontWeight: 700, color: (showLive ? live.avgReturn : stats.avgReturn) >= 0 ? theme.up : theme.down }}>
              {showLive ? formatReturn(live.avgReturn) : stats.total ? formatReturn(stats.avgReturn) : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* 최근 결과: 오래된 것부터 오른쪽으로. 색과 함께 ✓/✕로 구분한다 */}
      {stats.recent.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
          <div style={{ fontSize: 11, color: theme.textMuted }}>최근 결과</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {stats.recent.map(r => {
              const hit = r.result!.isHit;
              return (
                <div
                  key={r.id}
                  onClick={() => onSelect(r)}
                  onMouseEnter={() => setHovered(r)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    width: 22, height: 22, borderRadius: 5, cursor: 'pointer',
                    background: hit ? HIT_COLOR : MISS_COLOR, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800,
                    outline: hovered?.id === r.id ? `2px solid ${theme.text}` : 'none', outlineOffset: 1,
                  }}
                >
                  {hit ? '✓' : '✕'}
                </div>
              );
            })}
          </div>
          {hovered && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 5, whiteSpace: 'nowrap',
              background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 8,
              boxShadow: '0 6px 18px rgba(0,0,0,.2)', padding: '7px 10px', fontSize: 12,
            }}>
              <span style={{ fontWeight: 700 }}>{hovered.stockName}</span>
              <span style={{ color: theme.textMuted }}>
                {' '}· {hovered.opinion === 'BUY' ? '매수' : '매도'} · {formatDate(hovered.result!.evaluatedAt)} 검증 ·{' '}
              </span>
              <span style={{ fontWeight: 700, color: hovered.result!.returnRate >= 0 ? theme.up : theme.down }}>
                {formatReturn(hovered.result!.returnRate)}
              </span>
            </div>
          )}
        </div>
      )}

      {best && (
        <div
          onClick={() => onSelect(best)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            padding: '10px 12px', borderRadius: 10, background: theme.panel2,
          }}
        >
          <span style={{ fontSize: 15 }}>🏆</span>
          <StockLogo name={best.stockName} code={best.stockCode} size={24} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {showLive ? '현재 베스트' : '베스트 적중'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {best.stockName}{' '}
              <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 600 }}>
                {best.opinion === 'BUY' ? '매수' : '매도'}
              </span>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 800, color: HIT_COLOR }}>
            {formatReturn(directionalReturn(best))}
          </div>
        </div>
      )}
    </div>
  );
}

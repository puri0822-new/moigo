import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { formatDate } from './AiRecommendationModal';
import { hitRateTrend, useAiRecommendations } from '../lib/aiRecommendations';
import { useAiModels } from '../lib/aiModels';

const HEIGHT = 220;
const PAD = { top: 16, right: 84, bottom: 28, left: 40 };
// 적중률이 대부분 40~70%대라 0~100%로 그리면 선이 붙어 보여서 범위를 좁혀 그린다
const Y_MIN = 0.3, Y_MAX = 0.8;
const Y_TICKS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8];

const pct = (v: number | undefined) => (v == null ? '-' : `${Math.round(v * 100)}%`);

// AI별 주간 누적 적중률 꺾은선. 마우스를 올리면 그 주의 값을 보여준다
export default function AiHitRateTrendChart() {
  const { theme } = useTheme();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const { past } = useAiRecommendations();
  const data = hitRateTrend(past);
  // 추이 데이터가 있는 모델만 선으로 그린다 (새로 추가된 모델은 결과가 쌓이면 나타난다)
  const series = useAiModels().filter(ai => data.some(d => d.rates[ai.model] != null));

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
    // 표 ↔ 그래프를 오가면 그래프 영역이 새로 생기므로 다시 감시한다
  }, [showTable]);

  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - (Math.min(Math.max(v, Y_MIN), Y_MAX) - Y_MIN) / (Y_MAX - Y_MIN)) * plotH;

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setHover(Math.round(ratio * (data.length - 1)));
  };

  const tooltipLeft = hover == null ? 0 : Math.min(x(hover) + 12, width - 150);

  return (
    <div style={{
      background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14,
      padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>적중률 추이</div>
        <div style={{ fontSize: 12, color: theme.textMuted }}>주별 누적</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {series.map(ai => (
            <div key={ai.model} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.textMuted }}>
              <span style={{ width: 14, height: 3, borderRadius: 2, background: ai.color }} />
              {ai.name}
            </div>
          ))}
          <div
            onClick={() => setShowTable(v => !v)}
            style={{
              fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, cursor: 'pointer',
              color: theme.textMuted, border: `1px solid ${theme.border}`,
            }}
          >
            {showTable ? '그래프로 보기' : '표로 보기'}
          </div>
        </div>
      </div>

      {showTable ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: theme.textMuted }}>
              <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 600 }}>주</th>
              {series.map(ai => (
                <th key={ai.model} style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 600 }}>{ai.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(d => (
              <tr key={d.week} style={{ borderTop: `1px solid ${theme.border}` }}>
                <td style={{ padding: '6px 4px' }}>{formatDate(d.week)}</td>
                {series.map(ai => (
                  <td key={ai.model} style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 600 }}>{pct(d.rates[ai.model])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={wrapRef} style={{ position: 'relative' }}>
          <svg width={width} height={HEIGHT} style={{ display: 'block' }}>
            {/* 눈금선 */}
            {Y_TICKS.map(t => (
              <g key={t}>
                <line
                  x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)}
                  stroke={theme.border} strokeWidth={1} strokeDasharray={t === 0.5 ? '4 4' : undefined}
                />
                <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={theme.textMuted}>
                  {pct(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => (
              <text key={d.week} x={x(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={theme.textMuted}>
                {formatDate(d.week)}
              </text>
            ))}

            {hover != null && (
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke={theme.textMuted} strokeWidth={1} />
            )}

            {series.map(ai => {
              // 값이 없는 주는 건너뛰고 이어 그린다
              const pts = data.flatMap((d, i) => {
                const v = d.rates[ai.model];
                return v == null ? [] : [{ i, v }];
              });
              const points = pts.map(p => `${x(p.i)},${y(p.v)}`).join(' ');
              const last = pts[pts.length - 1];
              return (
                <g key={ai.model}>
                  <polyline points={points} fill="none" stroke={ai.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {/* 끝점 바로 옆에 이름과 최신 값 */}
                  <circle cx={x(last.i)} cy={y(last.v)} r={4} fill={ai.color} stroke={theme.panel} strokeWidth={2} />
                  <text
                    x={x(last.i) + 10} y={y(last.v)}
                    dominantBaseline="middle" fontSize={12} fontWeight={700} fill={theme.text}
                  >
                    {ai.name} {pct(last.v)}
                  </text>
                  {hover != null && data[hover].rates[ai.model] != null && (
                    <circle cx={x(hover)} cy={y(data[hover].rates[ai.model]!)} r={5} fill={ai.color} stroke={theme.panel} strokeWidth={2} />
                  )}
                </g>
              );
            })}

            {/* 마우스 감지 영역 */}
            <rect
              x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="transparent"
              onMouseMove={onMove} onMouseLeave={() => setHover(null)}
            />
          </svg>

          {hover != null && (
            <div style={{
              position: 'absolute', top: PAD.top, left: tooltipLeft, pointerEvents: 'none', minWidth: 130,
              background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 8,
              boxShadow: '0 6px 18px rgba(0,0,0,.2)', padding: '8px 10px', fontSize: 12,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ color: theme.textMuted }}>{formatDate(data[hover].week)} 주</div>
              {series.map(ai => (
                <div key={ai.model} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: ai.color }} />
                  <span style={{ color: theme.textMuted }}>{ai.name}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{pct(data[hover].rates[ai.model])}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

interface Holding {
  stock_id: number;
  stock_name: string;
  eval_amount: number;
}

interface Props {
  holdings: Holding[];
}

// 조각이 많아지면 비슷한 크기끼리 비교가 안 되므로, 큰 종목 5개까지만 따로 보여주고 나머지는 '기타'로 묶는다
const MAX_SLICES = 6;
// 색각 이상에서도 이웃한 조각이 구분되도록 검증한 순서. 순서를 바꾸거나 색을 더 만들어 쓰지 않는다
const SLICE_COLORS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'],
};

const SIZE = 168;
const RADIUS = 66;
const THICKNESS = 26;

function polar(angle: number, radius: number) {
  // 12시 방향에서 시작해 시계 방향으로 돈다
  const rad = (angle - 90) * (Math.PI / 180);
  return [SIZE / 2 + radius * Math.cos(rad), SIZE / 2 + radius * Math.sin(rad)];
}

function arcPath(start: number, end: number) {
  const inner = RADIUS - THICKNESS;
  // 조각 하나가 원 전체면 시작점과 끝점이 겹쳐 호가 그려지지 않으므로 살짝 덜 그린다
  const sweep = Math.min(end - start, 359.99);
  const [x1, y1] = polar(start, RADIUS);
  const [x2, y2] = polar(start + sweep, RADIUS);
  const [x3, y3] = polar(start + sweep, inner);
  const [x4, y4] = polar(start, inner);
  const large = sweep > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
}

export default function HoldingsDonut({ holdings }: Props) {
  const { theme, mode } = useTheme();
  const [hovered, setHovered] = useState<string | null>(null);

  const sorted = [...holdings].filter(h => h.eval_amount > 0).sort((a, b) => b.eval_amount - a.eval_amount);
  const total = sorted.reduce((sum, h) => sum + h.eval_amount, 0);

  if (total === 0) {
    return (
      <div style={{ height: SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: theme.textMuted }}>
        보유 종목이 없습니다
      </div>
    );
  }

  const head = sorted.length > MAX_SLICES ? sorted.slice(0, MAX_SLICES - 1) : sorted;
  const tail = sorted.slice(head.length);
  const slices = head.map(h => ({ key: String(h.stock_id), name: h.stock_name, amount: h.eval_amount }));
  if (tail.length > 0) {
    slices.push({ key: 'others', name: `기타 ${tail.length}종목`, amount: tail.reduce((sum, h) => sum + h.eval_amount, 0) });
  }

  const colors = SLICE_COLORS[mode];
  let angle = 0;
  const arcs = slices.map((s, i) => {
    const start = angle;
    angle += (s.amount / total) * 360;
    return { ...s, start, end: angle, color: colors[i], pct: (s.amount / total) * 100 };
  });
  const active = arcs.find(a => a.key === hovered);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ flexShrink: 0 }} role="img" aria-label="보유 종목 비중">
        {arcs.map(a => (
          <path
            key={a.key}
            d={arcPath(a.start, a.end)}
            fill={a.color}
            // 조각 사이는 배경색 테두리로 띄워서, 색이 비슷해 보여도 경계가 드러나게 한다
            stroke={theme.panel}
            strokeWidth={2}
            opacity={hovered && hovered !== a.key ? 0.35 : 1}
            style={{ transition: 'opacity 0.15s', cursor: 'default' }}
            onMouseEnter={() => setHovered(a.key)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        {/* 가운데: 가리킨 조각의 비중, 아무것도 가리키지 않으면 주식 평가액 합계 */}
        <text x={SIZE / 2} y={SIZE / 2 - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={theme.textMuted}>
          {active ? active.name : '주식 평가액'}
        </text>
        <text x={SIZE / 2} y={SIZE / 2 + 13} textAnchor="middle" fontSize={15} fontWeight={800} fill={theme.text}>
          {active ? `${active.pct.toFixed(1)}%` : `${Math.round(total / 10_000).toLocaleString()}만원`}
        </text>
      </svg>

      {/* 범례가 곧 표다: 색만으로 구분하지 않도록 이름·비중·금액을 같이 적는다.
          카드가 좁아도 종목 이름이 잘리지 않게 이름과 비중을 한 줄에, 금액은 그 아래 줄에 둔다 */}
      <div style={{ flex: '1 1 140px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {arcs.map(a => (
          <div
            key={a.key}
            onMouseEnter={() => setHovered(a.key)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 8px', borderRadius: 6,
              background: hovered === a.key ? theme.panel2 : 'transparent',
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: a.color, flexShrink: 0, marginTop: 4 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 700, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{a.name}</span>
                <span style={{ fontWeight: 700, flexShrink: 0 }}>{a.pct.toFixed(1)}%</span>
              </div>
              <div style={{ fontSize: 11, color: theme.textMuted }}>{a.amount.toLocaleString()}원</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

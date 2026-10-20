import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

// 가로 300 × 세로 100 좌표에 그린 선. 크게 오르내리며(번개처럼 꺾이며) 전체적으로는 완만하게 우상향한다
const W = 300;
const H = 100;
const Y = [88, 50, 68, 30, 48, 10];
const LINE = 'M' + Y.map((y, i) => `${(i / (Y.length - 1)) * W},${y}`).join(' L');
const AREA = `${LINE} L${W},${H} L0,${H} Z`;
const COLOR = '#ff8a94';

// 14초 한 바퀴: 앞 절반 동안 그려지고, 다 그려지면 번쩍인 뒤 잠시 머물다 한 번에 사라진다
const CYCLE_MS = 14_000;
const DRAW_END = 0.5;
const HIDE_AT = 0.86;

// 처음엔 천천히, 중간에 확 치고 오르다가 끝에서 멈추듯
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function BannerStrikeChart({ style }: { style?: CSSProperties }) {
  const groupRef = useRef<SVGGElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const arrowRef = useRef<SVGPolygonElement>(null);

  useEffect(() => {
    const group = groupRef.current!;
    const line = lineRef.current!;
    const area = areaRef.current!;
    const arrow = arrowRef.current!;
    const total = line.getTotalLength();
    line.style.strokeDasharray = `${total}`;

    // 화살표를 선의 len 지점에 두고, 그 지점의 진행 방향으로 돌린다
    const placeArrow = (len: number) => {
      const p = line.getPointAtLength(len);
      const q = line.getPointAtLength(len >= 1 ? len - 1 : len + 1);
      const angle = (Math.atan2(p.y - q.y, p.x - q.x) * 180) / Math.PI + (len >= 1 ? 0 : 180);
      arrow.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle})`);
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      line.style.strokeDashoffset = '0';
      area.style.opacity = '0.5';
      placeArrow(total);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = ((now - start) % CYCLE_MS) / CYCLE_MS;
      if (t >= HIDE_AT) {
        group.style.opacity = '0';
      } else {
        group.style.opacity = '1';
        const drawn = t < DRAW_END ? easeInOutCubic(t / DRAW_END) : 1;
        line.style.strokeDashoffset = `${total * (1 - drawn)}`;
        placeArrow(total * drawn);

        // 다 그려진 직후: 선이 한 번 깜빡이고, 아래 영역이 번쩍였다가 은은하게 남는다
        const since = t - DRAW_END;
        const blink = since >= 0.02 && since < 0.05;
        line.style.opacity = blink ? '0.4' : '1';
        arrow.style.opacity = blink ? '0.4' : '1';
        area.style.opacity = since < 0 ? '0'
          : since < 0.03 ? `${since / 0.03}`
          : `${Math.max(0.5, 1 - ((since - 0.03) / 0.07) * 0.5)}`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div aria-hidden style={{ pointerEvents: 'none', ...style }}>
      <svg width="100%" height="100%" viewBox={`-8 -8 ${W + 16} ${H + 8}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="bannerStrikeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLOR} stopOpacity={0.28} />
            <stop offset="100%" stopColor={COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <g ref={groupRef} style={{ opacity: 0 }}>
          <path ref={areaRef} d={AREA} fill="url(#bannerStrikeFill)" style={{ opacity: 0 }} />
          <g style={{ filter: `drop-shadow(0 0 3px ${COLOR}) drop-shadow(0 0 8px ${COLOR})` }}>
            <path
              ref={lineRef}
              d={LINE}
              fill="none"
              stroke={COLOR}
              strokeWidth={2.2}
              strokeLinejoin="miter"
              strokeLinecap="round"
            />
            {/* 그려지는 선의 맨 앞을 따라가는 화살표 */}
            <polygon ref={arrowRef} points="3,0 -8,-5.5 -5,0 -8,5.5" fill={COLOR} />
          </g>
        </g>
      </svg>
    </div>
  );
}

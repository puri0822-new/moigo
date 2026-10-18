import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from '../context/ThemeContext';

interface HorizontalScrollProps {
  children: ReactNode;
  gap?: number;
}

// 스크롤바 없이 가로로 넘기는 줄. 양옆에 더 있으면 가장자리를 흐리게 하고 화살표 버튼을 띄운다.
export default function HorizontalScroll({ children, gap = 12 }: HorizontalScrollProps) {
  const { theme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    // 창 크기가 바뀌거나 카드가 늘어나도 넘칠 여부를 다시 계산한다
    const observer = new ResizeObserver(update);
    observer.observe(el);
    Array.from(el.children).forEach(child => observer.observe(child));
    return () => observer.disconnect();
  }, [children]);

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const edge = (side: 'left' | 'right') => (
    <>
      <div style={{
        position: 'absolute', top: 0, bottom: 0, [side]: 0, width: 56, pointerEvents: 'none',
        background: `linear-gradient(to ${side === 'left' ? 'right' : 'left'}, ${theme.bg}, transparent)`,
      }} />
      <div
        onClick={() => scrollBy(side === 'left' ? -1 : 1)}
        style={{
          position: 'absolute', top: '50%', [side]: 6, transform: 'translateY(-50%)',
          width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
          background: theme.panel, border: `1px solid ${theme.border}`,
          boxShadow: '0 4px 12px rgba(0,0,0,.2)', color: theme.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points={side === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
        </svg>
      </div>
    </>
  );

  return (
    <div style={{ position: 'relative' }}>
      <div ref={ref} onScroll={update} className="hide-scrollbar" style={{ display: 'flex', gap, overflowX: 'auto' }}>
        {children}
      </div>
      {canLeft && edge('left')}
      {canRight && edge('right')}
    </div>
  );
}

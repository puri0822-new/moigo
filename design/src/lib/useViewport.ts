import { useEffect, useState } from 'react';

// 화면 폭 기준점. 스타일이 모두 인라인이라 미디어쿼리 대신 이 값으로 분기한다
export const MOBILE_MAX = 768; // 이보다 좁으면 휴대폰
export const COMPACT_MAX = 1200; // 이보다 좁으면 우측 패널을 접고 한 줄로 쌓는다

export function useViewport() {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return {
    width,
    isMobile: width < MOBILE_MAX,
    isCompact: width < COMPACT_MAX,
  };
}

import { useEffect, useRef } from 'react';

// 백엔드가 토스 현재가를 60초 캐시하므로 그보다 짧은 30초 간격이면 충분하다
export const PORTFOLIO_POLL_MS = 30_000;

/** 처음 한 번 실행하고 intervalMs마다 다시 실행한다.
 *  탭이 가려져 있으면 멈췄다가, 다시 보이면 바로 한 번 실행하고 이어간다. */
export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      savedCallback.current();
      timer = setInterval(() => savedCallback.current(), intervalMs);
    };
    const stop = () => clearInterval(timer);
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, enabled]);
}

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Theme } from '../types';

const themes: Record<'dark' | 'light', Theme> = {
  dark: {
    bg: 'oklch(0.15 0.004 260)',
    panel: 'oklch(0.19 0.005 260)',
    panel2: 'oklch(0.235 0.006 260)',
    border: 'oklch(0.32 0.006 260)',
    text: 'oklch(0.95 0.002 260)',
    textMuted: 'oklch(0.62 0.006 260)',
    // 상승·매수 빨강. 하락 파랑(#4361ee)과 명도·채도를 같게(OKLCH L 0.556, C 0.214) 맞춘 색
    up: '#d41929',
    // 매도 버튼·하락 표시를 기간 선택 등 브랜드 파랑과 같은 색으로 통일
    down: '#4361ee',
    // 흰 글자 대비 5.0:1이 되도록 기존 #4F6EF7보다 한 단계 진하게
    ai: '#4361ee',
    aiSoft: 'rgba(67, 97, 238, 0.18)',
    aiText: '#ffffff',
    aiFg: '#7b8cff',
    success: '#4ade80',
    successSoft: 'rgba(74, 222, 128, 0.14)',
    warning: '#fbbf24',
    warningSoft: 'rgba(251, 191, 36, 0.14)',
    error: '#f87171',
    errorSoft: 'rgba(248, 113, 113, 0.14)',
    inputBorder: 'oklch(0.55 0.006 260)',
  },
  light: {
    bg: 'oklch(0.985 0.002 260)',
    panel: 'oklch(1 0 0)',
    panel2: 'oklch(0.96 0.003 260)',
    border: 'oklch(0.89 0.004 260)',
    text: 'oklch(0.2 0.006 260)',
    textMuted: 'oklch(0.48 0.008 260)',
    up: '#d41929',
    down: '#4361ee',
    ai: '#4361ee',
    aiSoft: 'rgba(67, 97, 238, 0.10)',
    aiText: '#ffffff',
    aiFg: '#4361ee',
    success: '#15803d',
    successSoft: 'rgba(21, 128, 61, 0.10)',
    warning: '#b45309',
    warningSoft: 'rgba(180, 83, 9, 0.10)',
    // 상승 빨강(#d41929)과 거의 같던 #dc2626을 같은 색으로 합침 (흰 배경 대비 5.3)
    error: '#d41929',
    errorSoft: 'rgba(212, 25, 41, 0.08)',
    inputBorder: 'oklch(0.62 0.006 260)',
  },
};

interface ThemeContextValue {
  theme: Theme;
  mode: 'dark' | 'light';
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'dark' | 'light'>('light');
  const toggle = () => setMode(m => (m === 'dark' ? 'light' : 'dark'));
  // 전역 CSS(포커스 링 등)가 테마 색을 쓸 수 있게 CSS 변수로 내보낸다
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--focus-ring', themes[mode].aiFg);
    root.setProperty('color-scheme', mode);
  }, [mode]);
  return (
    <ThemeContext.Provider value={{ theme: themes[mode], mode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

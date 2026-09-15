import { createContext, useContext, useState } from 'react';
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
    up: 'oklch(0.72 0.16 148)',
    down: 'oklch(0.68 0.19 25)',
    ai: 'oklch(0.74 0.13 264)',
  },
  light: {
    bg: 'oklch(0.985 0.002 260)',
    panel: 'oklch(1 0 0)',
    panel2: 'oklch(0.96 0.003 260)',
    border: 'oklch(0.89 0.004 260)',
    text: 'oklch(0.2 0.006 260)',
    textMuted: 'oklch(0.48 0.008 260)',
    up: 'oklch(0.52 0.15 148)',
    down: 'oklch(0.55 0.19 25)',
    ai: 'oklch(0.5 0.14 264)',
  },
};

interface ThemeContextValue {
  theme: Theme;
  mode: 'dark' | 'light';
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const toggle = () => setMode(m => (m === 'dark' ? 'light' : 'dark'));
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

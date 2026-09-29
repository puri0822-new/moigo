import { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
import type { UTCTimestamp } from 'lightweight-charts';
import { useTheme } from '../context/ThemeContext';

type Period = '1일' | '1주' | '1개월' | '1년';

function generateCandles(basePrice: number, count: number, intervalMinutes: number) {
  const candles = [];
  let price = basePrice;
  const now = Math.floor(Date.now() / 1000);
  const interval = intervalMinutes * 60;

  for (let i = count - 1; i >= 0; i--) {
    const time = (now - i * interval) as UTCTimestamp;
    const change = (Math.random() - 0.48) * price * 0.015;
    const open = price;
    const close = Math.round(price + change);
    const high = Math.round(Math.max(open, close) + Math.random() * price * 0.005);
    const low = Math.round(Math.min(open, close) - Math.random() * price * 0.005);
    candles.push({ time, open, high, low, close });
    price = close;
  }
  return candles;
}

const periodConfig: Record<Period, { count: number; intervalMinutes: number }> = {
  '1일':   { count: 78, intervalMinutes: 5 },
  '1주':   { count: 35, intervalMinutes: 60 },
  '1개월': { count: 30, intervalMinutes: 1440 },
  '1년':   { count: 52, intervalMinutes: 10080 },
};

interface Props {
  basePrice: number;
  period: Period;
  height?: number;
}

export default function StockChart({ basePrice, period, height = 210 }: Props) {
  const { theme, mode } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: theme.textMuted,
      },
      grid: {
        vertLines: { color: theme.border },
        horzLines: { color: theme.border },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: theme.border },
      timeScale: { borderColor: theme.border, timeVisible: true, secondsVisible: false },
      width: el.offsetWidth || 400,
      height,
    });

    const cfg = periodConfig[period];
    const data = generateCandles(basePrice, cfg.count, cfg.intervalMinutes);

    const series = chart.addSeries(CandlestickSeries, {
      upColor: theme.up,
      downColor: theme.down,
      borderUpColor: theme.up,
      borderDownColor: theme.down,
      wickUpColor: theme.up,
      wickDownColor: theme.down,
    });

    series.setData(data);
    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.offsetWidth });
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [basePrice, period, mode, height]);

  return <div ref={containerRef} style={{ width: '100%', height }} />;
}

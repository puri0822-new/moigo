import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, type IChartApi, type CandlestickData, type UTCTimestamp } from 'lightweight-charts';
import type { Theme } from '../types';

interface Props {
  data: CandlestickData<UTCTimestamp | string>[];
  theme: Theme;
}

export default function CandleChart({ data, theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { color: 'transparent' }, textColor: theme.textMuted },
      grid: {
        vertLines: { color: theme.border },
        horzLines: { color: theme.border },
      },
      timeScale: { borderColor: theme.border },
      rightPriceScale: { borderColor: theme.border },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: theme.up,
      downColor: theme.down,
      borderVisible: false,
      wickUpColor: theme.up,
      wickDownColor: theme.down,
    });
    series.setData(data);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (el) chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, theme]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

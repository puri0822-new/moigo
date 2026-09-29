import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, type IChartApi, type CandlestickData, type UTCTimestamp } from 'lightweight-charts';
import type { Theme } from '../types';
import { toRgb } from '../lib/color';

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

    // lightweight-charts는 oklch() 등 최신 CSS 색상 함수를 파싱하지 못하므로 rgb()로 변환해서 전달
    const textMuted = toRgb(theme.textMuted);
    const border = toRgb(theme.border);
    const up = toRgb(theme.up);
    const down = toRgb(theme.down);

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { color: 'transparent' }, textColor: textMuted },
      grid: {
        vertLines: { color: border },
        horzLines: { color: border },
      },
      timeScale: { borderColor: border },
      rightPriceScale: { borderColor: border },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderVisible: false,
      wickUpColor: up,
      wickDownColor: down,
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

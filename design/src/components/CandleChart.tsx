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
      // 생성 시점에 컨테이너 크기가 0일 수 있으므로 고정 크기 대신 컨테이너 크기 변화를 따라가게 한다
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: textMuted },
      grid: {
        vertLines: { color: border },
        horzLines: { color: border },
      },
      // 분봉(숫자 timestamp)일 때만 시:분까지 표시. 일봉은 'YYYY-MM-DD' 문자열이라 날짜만 나온다
      timeScale: { borderColor: border, timeVisible: typeof data[0]?.time === 'number', secondsVisible: false },
      localization: { priceFormatter: (price: number) => Math.round(price).toLocaleString() },
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

    return () => {
      chart.remove();
    };
  }, [data, theme]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

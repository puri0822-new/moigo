import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type CandlestickData, type UTCTimestamp } from 'lightweight-charts';
import type { Theme } from '../types';
import { toRgb } from '../lib/color';

interface Props {
  data: CandlestickData<UTCTimestamp | string>[];
  theme: Theme;
  // 처음 화면에 보여줄 최근 막대 개수. 전체 데이터는 다 들어 있고, 드래그로 과거로 이동하거나 휠로 확대·축소하면 나머지가 보인다.
  visibleBars?: number;
  // 폴링으로 받은 최신 막대. 차트를 다시 만들지 않고 마지막 막대만 갱신해서 사용자의 확대·이동 상태가 유지된다.
  liveBar?: CandlestickData<UTCTimestamp | string> | null;
}

export default function CandleChart({ data, theme, visibleBars, liveBar }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

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
      // 분봉(숫자 timestamp)일 때만 시:분까지 표시. 일봉은 'YYYY-MM-DD' 문자열이라 날짜만 나온다.
      // 전체 이력을 한 화면에 다 넣을 수 있을 만큼 축소를 허용하고, 왼쪽 끝 밖으로는 스크롤되지 않게 한다
      timeScale: {
        borderColor: border, timeVisible: typeof data[0]?.time === 'number', secondsVisible: false,
        fixLeftEdge: true, minBarSpacing: 0.1,
      },
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
    seriesRef.current = series;
    series.setData(data);
    if (visibleBars && data.length > visibleBars) {
      chart.timeScale().setVisibleLogicalRange({ from: data.length - visibleBars, to: data.length - 1 });
    } else {
      chart.timeScale().fitContent();
    }

    return () => {
      seriesRef.current = null;
      chart.remove();
    };
  }, [data, theme, visibleBars]);

  useEffect(() => {
    if (!liveBar || !seriesRef.current) return;
    try {
      seriesRef.current.update(liveBar);
    } catch {
      // 이미 그려진 마지막 막대보다 오래된 시각이면 차트 라이브러리가 거절한다. 다음 폴링에서 다시 맞춰진다.
    }
  }, [liveBar]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

import { useEffect, useRef, useState } from 'react';
import { createChart, LineSeries, LineStyle } from 'lightweight-charts';
import { useTheme } from '../context/ThemeContext';
import { toRgb } from '../lib/color';
import type { ApiAssetPoint } from '../lib/api';

interface Props {
  points: ApiAssetPoint[];
  initialBalance: number;
}

// 자산 추이는 한 줄짜리 그래프라 범례 없이 계열 색 하나만 쓴다 (상승·하락 색은 손익 표시에만 쓴다)
const LINE_COLOR = { light: '#2a78d6', dark: '#3987e5' };

export default function AssetTrendChart({ points, initialBalance }: Props) {
  const { theme, mode } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  // 그래프 위에 마우스를 올린 날짜. 없으면 가장 최근 날짜를 보여준다
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || points.length < 2) return;

    const textMuted = toRgb(theme.textMuted);
    const border = toRgb(theme.border);

    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: textMuted, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: border } },
      timeScale: { borderColor: border, fixLeftEdge: true, fixRightEdge: true },
      rightPriceScale: { borderColor: border },
      localization: { priceFormatter: (price: number) => `${Math.round(price / 10_000).toLocaleString()}만` },
      // 기간 전체를 한눈에 보는 그래프라 확대·이동은 막는다
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(LineSeries, {
      color: LINE_COLOR[mode],
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerRadius: 4,
    });
    series.setData(points.map(p => ({ time: p.date, value: p.total_asset })));
    // 처음 받은 원금. 선이 이 위에 있으면 번 것이다
    series.createPriceLine({
      price: initialBalance, color: textMuted, lineWidth: 1, lineStyle: LineStyle.Dashed,
      axisLabelVisible: false, title: '원금',
    });
    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove(param => {
      setHoveredDate(typeof param.time === 'string' ? param.time : null);
    });

    return () => chart.remove();
  }, [points, initialBalance, theme, mode]);

  if (points.length < 2) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: theme.textMuted }}>
        내일부터 자산 추이가 그려집니다
      </div>
    );
  }

  const shown = points.find(p => p.date === hoveredDate) ?? points[points.length - 1];
  const profit = shown.total_asset - initialBalance;
  const profitRate = initialBalance > 0 ? (profit / initialBalance) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 가리킨 날짜의 값. 색으로만 구분하지 않도록 부호와 함께 적는다 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>{shown.total_asset.toLocaleString()}원</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: profit >= 0 ? theme.up : theme.down }}>
          원금 대비 {profit >= 0 ? '+' : ''}{profit.toLocaleString()}원 ({profit >= 0 ? '+' : ''}{profitRate.toFixed(2)}%)
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: theme.textMuted }}>
          {shown.date} · 현금 {shown.cash.toLocaleString()}원 · 주식 {shown.stock_value.toLocaleString()}원
        </span>
      </div>
      <div ref={containerRef} style={{ height: 220 }} />
    </div>
  );
}

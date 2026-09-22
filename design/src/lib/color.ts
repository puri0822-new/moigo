// lightweight-charts의 내부 색상 파서는 oklch() 등 최신 CSS 색상 함수를 이해하지 못해
// 그대로 넘기면 런타임 에러가 난다. getComputedStyle은 최신 브라우저에서 oklch()를
// 그대로 되돌려주는 경우가 있어 신뢰할 수 없고, canvas 2D 컨텍스트에 그려서 실제
// 픽셀 값을 읽어오는 방식만 항상 rgb 정수로 변환됨을 보장한다.
export function toRgb(color: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}

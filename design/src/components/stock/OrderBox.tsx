import { useEffect, useId, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { COMPACT_MAX, MOBILE_MAX, useViewport } from '../../lib/useViewport';
import { FS, FW, RADIUS } from '../../lib/tokens';

export type OrderPriceType = 'limit' | 'market';

const BOX_WIDTH = 292;
// 넓은 화면에서 종목 상세 우측 패널(AI 인사이트·내 모의매매)이 차지하는 폭
const RIGHT_PANEL_WIDTH = 300;
const POS_STORAGE_KEY = 'moigo:order-box-pos';

// 처음 위치: 우측 패널이 옆에 있으면 그 왼쪽(차트 쪽)에 띄워 AI 인사이트를 가리지 않는다.
// 좁은 화면에서는 우측 패널이 본문 아래로 내려가므로 오른쪽 끝에 붙인다
function defaultPos() {
  const rightGap = window.innerWidth >= COMPACT_MAX ? RIGHT_PANEL_WIDTH + 16 : 24;
  return { x: window.innerWidth - BOX_WIDTH - rightGap, y: window.innerHeight - 540 };
}

function loadSavedPos(): { x: number; y: number } | null {
  try {
    const saved = JSON.parse(localStorage.getItem(POS_STORAGE_KEY) ?? 'null');
    return typeof saved?.x === 'number' && typeof saved?.y === 'number' ? saved : null;
  } catch {
    return null;
  }
}

function savePos(pos: { x: number; y: number }) {
  try {
    localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // 저장소를 못 쓰는 환경이면 위치 기억만 건너뛴다
  }
}

interface OrderBoxProps {
  stockName: string;
  currentPrice: number;
  // 지정가/시장가와 지정가 금액은 호가를 눌러서도 바뀌므로 페이지가 들고 있는다
  orderType: OrderPriceType;
  onOrderTypeChange: (type: OrderPriceType) => void;
  inputPrice: number;
  setInputPrice: Dispatch<SetStateAction<number>>;
  // 미체결 주문에 묶인 금액·수량을 뺀 값. 계좌를 못 불러왔으면 null
  orderableBalance: number | null;
  heldQty: number;
  submitting: boolean;
  onOrder: (side: 'buy' | 'sell', qty: number) => void;
}

// 플로팅 모의주문 창. 넓은 화면에서는 끌어서 옮기고, 휴대폰에서는 화면 아래에 붙인다
export default function OrderBox({
  stockName, currentPrice, orderType, onOrderTypeChange, inputPrice, setInputPrice,
  orderableBalance, heldQty, submitting, onOrder,
}: OrderBoxProps) {
  const { theme } = useTheme();
  const { width: viewportWidth, isMobile } = useViewport();
  const [qty, setQty] = useState(1);
  // 10%~최대 버튼의 기준: 매수는 가상현금으로 살 수 있는 수량, 매도는 보유 수량
  const [ratioBase, setRatioBase] = useState<'buy' | 'sell'>('buy');
  const [floatPos, setFloatPos] = useState({ x: 0, y: 0 });
  // 휴대폰에서는 주문창이 화면 아래를 덮으므로 접힌 상태로 시작한다
  const [floatMinimized, setFloatMinimized] = useState(() => window.innerWidth < MOBILE_MAX);
  // 주문 중일 때 어느 버튼을 눌렀는지 (그 버튼에만 "주문 중…" 표시)
  const [pendingSide, setPendingSide] = useState<'buy' | 'sell'>('buy');
  const priceId = useId();
  const qtyId = useId();
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    setFloatPos(loadSavedPos() ?? defaultPos());
  }, []);

  // 창을 줄이면 주문창이 화면 밖으로 밀려나지 않게 안쪽으로 당긴다
  useEffect(() => {
    setFloatPos(p => ({
      x: Math.max(0, Math.min(p.x, viewportWidth - 300)),
      y: Math.max(0, Math.min(p.y, window.innerHeight - 48)),
    }));
  }, [viewportWidth]);

  const effectivePrice = orderType === 'market' ? currentPrice : inputPrice;
  const total = effectivePrice * qty;
  const buyableQty = orderableBalance != null && effectivePrice > 0 ? Math.floor(orderableBalance / effectivePrice) : 0;

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: floatPos.x, origY: floatPos.y };
    let moved: { x: number; y: number } | null = null;
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      moved = {
        x: Math.max(0, Math.min(window.innerWidth - 300, dragRef.current.origX + e.clientX - dragRef.current.startX)),
        y: Math.max(0, Math.min(window.innerHeight - 48, dragRef.current.origY + e.clientY - dragRef.current.startY)),
      };
      setFloatPos(moved);
    };
    const onUp = () => {
      dragRef.current = null;
      // 옮긴 자리를 기억해 두고 다른 종목·다음 방문에서도 같은 자리에 띄운다
      if (moved) savePos(moved);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const applyRatio = (ratio: number) => {
    const base = ratioBase === 'buy' ? buyableQty : heldQty;
    setQty(Math.max(1, Math.floor(base * ratio)));
  };

  // 가격·수량 ± 같은 작은 정사각 버튼. 터치 대상 최소 크기(24px)보다 넉넉하게 32px
  const stepButton = (enabled: boolean) => ({
    width: 32, height: 32, borderRadius: RADIUS.md, border: `1px solid ${theme.inputBorder}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    fontSize: FS.title, color: theme.text, opacity: enabled ? 1 : 0.4,
  });

  const fieldBox = (muted: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${theme.inputBorder}`,
    borderRadius: RADIUS.md, padding: '4px 8px', background: muted ? theme.panel2 : 'transparent',
  });

  const sideLabel = (side: 'buy' | 'sell') => (side === 'buy' ? '매수' : '매도');

  const submit = (side: 'buy' | 'sell') => {
    if (submitting) return;
    setPendingSide(side);
    onOrder(side, qty);
  };

  return (
    <section aria-label={`${stockName} 모의주문`} style={{
      position: 'fixed', zIndex: 40,
      background: theme.panel, border: `1px solid ${theme.border}`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      overflow: 'hidden',
      ...(isMobile
        ? { left: 0, right: 0, bottom: 0, borderRadius: `${RADIUS.lg}px ${RADIUS.lg}px 0 0`, maxHeight: '80vh', overflowY: 'auto' }
        : { left: floatPos.x, top: floatPos.y, width: BOX_WIDTH, borderRadius: RADIUS.lg }),
    }}>
      {/* 드래그 핸들 (휴대폰에서는 손잡이 전체가 접기/펼치기) */}
      <div
        onMouseDown={isMobile ? undefined : handleDragStart}
        onClick={isMobile ? () => setFloatMinimized(v => !v) : undefined}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 8px 8px 16px', borderBottom: floatMinimized ? 'none' : `1px solid ${theme.border}`,
          cursor: isMobile ? 'pointer' : 'grab', userSelect: 'none', background: theme.panel2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden="true" style={{ fontSize: FS.caption, color: theme.textMuted }}>⠿</span>
          <span style={{ fontSize: FS.body, fontWeight: FW.semibold }}>{stockName} 모의주문</span>
        </div>
        <button
          type="button"
          aria-expanded={!floatMinimized}
          aria-label={floatMinimized ? '주문창 펼치기' : '주문창 접기'}
          onMouseDown={e => e.stopPropagation()}
          // 휴대폰에서는 손잡이 전체가 접기 버튼이라 두 번 토글되지 않게 막는다
          onClick={e => { e.stopPropagation(); setFloatMinimized(v => !v); }}
          style={{ width: 32, height: 32, borderRadius: RADIUS.md, fontSize: FS.body, color: theme.textMuted }}
        >{floatMinimized ? '▲' : '▼'}</button>
      </div>

      {!floatMinimized && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 지정가 / 시장가 */}
          <div role="group" aria-label="주문 방식" style={{ display: 'flex', background: theme.panel2, borderRadius: RADIUS.md, padding: 4, gap: 4 }}>
            {(['limit', 'market'] as const).map(t => (
              <button key={t} type="button" aria-pressed={orderType === t} onClick={() => onOrderTypeChange(t)} style={{
                flex: 1, padding: '8px 0', borderRadius: RADIUS.md,
                fontSize: FS.body, fontWeight: orderType === t ? FW.semibold : FW.medium,
                background: orderType === t ? theme.panel : 'transparent',
                color: orderType === t ? theme.text : theme.textMuted,
                boxShadow: orderType === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
                {t === 'limit' ? '지정가' : '시장가'}
              </button>
            ))}
          </div>

          {/* 가격 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor={priceId} style={{ fontSize: FS.caption, fontWeight: FW.medium, color: theme.textMuted }}>가격</label>
            <div style={fieldBox(orderType === 'market')}>
              <button type="button" aria-label="가격 100원 내리기" disabled={orderType === 'market'}
                onClick={() => setInputPrice(p => Math.max(0, p - 100))} style={stepButton(orderType === 'limit')}>−</button>
              {orderType === 'market' ? (
                <span id={priceId} style={{ flex: 1, textAlign: 'center', fontSize: FS.body, fontWeight: FW.medium, color: theme.textMuted }}>시장가</span>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <input id={priceId} type="text" inputMode="numeric"
                    value={inputPrice === 0 ? '' : inputPrice.toLocaleString()}
                    onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); setInputPrice(raw === '' ? 0 : parseInt(raw, 10)); }}
                    placeholder="0"
                    style={{ width: 0, flex: 1, textAlign: 'right', fontSize: FS.body, fontWeight: FW.medium, border: 'none', background: 'transparent', color: theme.text, fontFamily: 'inherit', padding: '8px 2px' }} />
                  <span style={{ fontSize: FS.body, fontWeight: FW.medium, color: theme.textMuted, flexShrink: 0 }}>원</span>
                </div>
              )}
              <button type="button" aria-label="가격 100원 올리기" disabled={orderType === 'market'}
                onClick={() => setInputPrice(p => p + 100)} style={stepButton(orderType === 'limit')}>+</button>
            </div>
            {orderType === 'limit' && (
              <span style={{ fontSize: FS.caption, color: theme.textMuted, lineHeight: 1.4 }}>
                지금 호가로 체결되지 않으면 미체결로 남아 지정가에 닿을 때 체결돼요 (당일 장 마감까지 유효)
              </span>
            )}
            {orderType === 'limit' && inputPrice > 0 && inputPrice < currentPrice * 0.9 && (
              <span role="alert" style={{ fontSize: FS.caption, fontWeight: FW.medium, color: theme.warning }}>
                ⚠ 현재가({currentPrice.toLocaleString()}원)보다 10% 이상 낮은 가격입니다
              </span>
            )}
          </div>

          {/* 수량 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label htmlFor={qtyId} style={{ fontSize: FS.caption, fontWeight: FW.medium, color: theme.textMuted }}>수량</label>
              <span style={{ fontSize: FS.caption, color: theme.textMuted }}>
                매수 가능 {buyableQty.toLocaleString()}주 · 매도 가능 {heldQty.toLocaleString()}주
              </span>
            </div>
            <div style={fieldBox(false)}>
              <button type="button" aria-label="수량 1주 줄이기" onClick={() => setQty(q => Math.max(1, q - 1))} style={stepButton(true)}>−</button>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <input id={qtyId} type="text" inputMode="numeric"
                  value={qty === 0 ? '' : qty.toLocaleString()}
                  onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); setQty(raw === '' ? 1 : Math.max(1, parseInt(raw, 10))); }}
                  placeholder="0"
                  style={{ width: 0, flex: 1, textAlign: 'right', fontSize: FS.body, fontWeight: FW.medium, border: 'none', background: 'transparent', color: theme.text, fontFamily: 'inherit', padding: '8px 2px' }} />
                <span style={{ fontSize: FS.body, fontWeight: FW.medium, color: theme.textMuted, flexShrink: 0 }}>주</span>
              </div>
              <button type="button" aria-label="수량 1주 늘리기" onClick={() => setQty(q => q + 1)} style={stepButton(true)}>+</button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {/* 비율 버튼 기준: 매수(가상현금으로 살 수 있는 수량) / 매도(보유 수량) */}
              <div role="group" aria-label="비율 기준" style={{ display: 'flex', background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, padding: 2, gap: 2, flexShrink: 0 }}>
                {(['buy', 'sell'] as const).map(b => (
                  <button key={b} type="button" aria-pressed={ratioBase === b} onClick={() => setRatioBase(b)} style={{
                    padding: '4px 8px', borderRadius: RADIUS.sm, fontSize: FS.caption, fontWeight: FW.semibold,
                    background: ratioBase === b ? (b === 'buy' ? theme.up : theme.down) : 'transparent',
                    color: ratioBase === b ? theme.aiText : theme.textMuted,
                  }}>{sideLabel(b)}</button>
                ))}
              </div>
              {([['10%', 0.1], ['25%', 0.25], ['50%', 0.5], ['최대', 1]] as const).map(([label, ratio]) => (
                <button key={label} type="button"
                  aria-label={`${sideLabel(ratioBase)} 가능 수량의 ${label}`}
                  onClick={() => applyRatio(ratio)}
                  style={{ flex: 1, padding: '8px 0', borderRadius: RADIUS.md, fontSize: FS.caption, fontWeight: FW.medium, background: theme.panel2, border: `1px solid ${theme.border}`, color: theme.text }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* 총 주문 금액 */}
          <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: FS.caption, color: theme.textMuted }}>{orderType === 'market' ? '예상 주문 금액' : '총 주문 금액'}</span>
            <span style={{ fontSize: FS.title, fontWeight: FW.bold }}>{total.toLocaleString()}원</span>
          </div>

          {/* 매수 / 매도. 주문 중에는 누른 쪽에 "주문 중…"을 보여주고 두 버튼 모두 막는다 */}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['buy', 'sell'] as const).map(side => (
              <button key={side} type="button" disabled={submitting} aria-busy={submitting && pendingSide === side}
                onClick={() => submit(side)}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: RADIUS.md,
                  background: side === 'buy' ? theme.up : theme.down,
                  // 매수 빨강·매도 파랑 모두 흰 글자일 때 대비 5:1 이상 (검은 글자는 다크 모드에서 부족)
                  color: theme.aiText,
                  fontWeight: FW.semibold, fontSize: FS.body,
                  opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer',
                }}
              >{submitting && pendingSide === side ? `${sideLabel(side)} 주문 중…` : sideLabel(side)}</button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { MOBILE_MAX, useViewport } from '../../lib/useViewport';

export type OrderPriceType = 'limit' | 'market';

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
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    setFloatPos({ x: window.innerWidth - 316, y: window.innerHeight - 540 });
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
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setFloatPos({
        x: Math.max(0, Math.min(window.innerWidth - 300, dragRef.current.origX + e.clientX - dragRef.current.startX)),
        y: Math.max(0, Math.min(window.innerHeight - 48, dragRef.current.origY + e.clientY - dragRef.current.startY)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
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

  return (
    <div style={{
      position: 'fixed', zIndex: 40,
      background: theme.panel, border: `1px solid ${theme.border}`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      overflow: 'hidden',
      ...(isMobile
        ? { left: 0, right: 0, bottom: 0, borderRadius: '14px 14px 0 0', maxHeight: '80vh', overflowY: 'auto' }
        : { left: floatPos.x, top: floatPos.y, width: 292, borderRadius: 14 }),
    }}>
      {/* 드래그 핸들 */}
      <div
        onMouseDown={isMobile ? undefined : handleDragStart}
        onClick={isMobile ? () => setFloatMinimized(v => !v) : undefined}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderBottom: floatMinimized ? 'none' : `1px solid ${theme.border}`,
          cursor: isMobile ? 'pointer' : 'grab', userSelect: 'none', background: theme.panel2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 11, color: theme.textMuted }}>⠿</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{stockName} 모의주문</span>
        </div>
        <div
          onMouseDown={e => e.stopPropagation()}
          // 휴대폰에서는 손잡이 전체가 접기 버튼이라 두 번 토글되지 않게 막는다
          onClick={e => { e.stopPropagation(); setFloatMinimized(v => !v); }}
          style={{ fontSize: 14, color: theme.textMuted, cursor: 'pointer', lineHeight: 1, padding: '2px 4px' }}
        >{floatMinimized ? '▲' : '▼'}</div>
      </div>

      {!floatMinimized && (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {/* 지정가 / 시장가 탭 */}
          <div style={{ display: 'flex', background: theme.panel2, borderRadius: 8, padding: 3, gap: 3 }}>
            {(['limit', 'market'] as const).map(t => (
              <div key={t} onClick={() => onOrderTypeChange(t)} style={{
                flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 6,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: orderType === t ? theme.panel : 'transparent',
                color: orderType === t ? theme.text : theme.textMuted,
                boxShadow: orderType === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
                {t === 'limit' ? '지정가' : '시장가'}
              </div>
            ))}
          </div>

          {/* 가격 입력 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted }}>가격</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '6px 10px', background: orderType === 'market' ? theme.panel2 : 'transparent' }}>
              <div onClick={() => orderType === 'limit' && setInputPrice(p => Math.max(0, p - 100))}
                style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: orderType === 'limit' ? 'pointer' : 'default', flexShrink: 0, opacity: orderType === 'market' ? 0.4 : 1 }}>-</div>
              {orderType === 'market' ? (
                <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: theme.textMuted }}>시장가</span>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <input type="text" inputMode="numeric"
                    value={inputPrice === 0 ? '' : inputPrice.toLocaleString()}
                    onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); setInputPrice(raw === '' ? 0 : parseInt(raw, 10)); }}
                    placeholder="0"
                    style={{ width: 0, flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', color: theme.text, fontFamily: 'inherit' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted, flexShrink: 0 }}>원</span>
                </div>
              )}
              <div onClick={() => orderType === 'limit' && setInputPrice(p => p + 100)}
                style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: orderType === 'limit' ? 'pointer' : 'default', flexShrink: 0, opacity: orderType === 'market' ? 0.4 : 1 }}>+</div>
            </div>
            {orderType === 'limit' && (
              <span style={{ fontSize: 10, color: theme.textMuted, lineHeight: 1.4 }}>
                지금 호가로 체결되지 않으면 미체결로 남아 지정가에 닿을 때 체결돼요 (당일 장 마감까지 유효)
              </span>
            )}
            {orderType === 'limit' && inputPrice > 0 && inputPrice < currentPrice * 0.9 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: theme.down }}>
                ⚠ 현재가({currentPrice.toLocaleString()}원)보다 10% 이상 낮은 가격입니다
              </span>
            )}
          </div>

          {/* 수량 입력 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted }}>수량</span>
              <span style={{ fontSize: 10, color: theme.textMuted }}>
                매수 가능 {buyableQty.toLocaleString()}주 · 매도 가능 {heldQty.toLocaleString()}주
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '6px 10px' }}>
              <div onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>-</div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <input type="text" inputMode="numeric"
                  value={qty === 0 ? '' : qty.toLocaleString()}
                  onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); setQty(raw === '' ? 1 : Math.max(1, parseInt(raw, 10))); }}
                  placeholder="0"
                  style={{ width: 0, flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', color: theme.text, fontFamily: 'inherit' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted, flexShrink: 0 }}>주</span>
              </div>
              <div onClick={() => setQty(q => q + 1)} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>+</div>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {/* 비율 버튼 기준: 매수(가상현금으로 살 수 있는 수량) / 매도(보유 수량) */}
              <div style={{ display: 'flex', background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 6, padding: 2, gap: 2, flexShrink: 0 }}>
                {(['buy', 'sell'] as const).map(b => (
                  <div key={b} onClick={() => setRatioBase(b)} style={{
                    padding: '3px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    background: ratioBase === b ? (b === 'buy' ? theme.up : theme.down) : 'transparent',
                    color: ratioBase === b ? theme.bg : theme.textMuted,
                  }}>{b === 'buy' ? '매수' : '매도'}</div>
                ))}
              </div>
              {[['10%', 0.1], ['25%', 0.25], ['50%', 0.5], ['최대', 1]].map(([label, ratio]) => (
                <div key={label as string}
                  onClick={() => applyRatio(ratio as number)}
                  style={{ flex: 1, textAlign: 'center', padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: theme.panel2, border: `1px solid ${theme.border}`, color: theme.textMuted }}
                >{label}</div>
              ))}
            </div>
          </div>

          {/* 총 주문 금액 */}
          <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: theme.textMuted }}>{orderType === 'market' ? '예상 주문 금액' : '총 주문 금액'}</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{total.toLocaleString()}원</span>
          </div>

          {/* 매수 / 매도 버튼 */}
          <div style={{ display: 'flex', gap: 8, opacity: submitting ? 0.6 : 1 }}>
            <div onClick={() => onOrder('buy', qty)} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: theme.up, color: theme.bg, fontWeight: 700, fontSize: 13, cursor: submitting ? 'wait' : 'pointer' }}>매수</div>
            <div onClick={() => onOrder('sell', qty)} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: theme.down, color: theme.bg, fontWeight: 700, fontSize: 13, cursor: submitting ? 'wait' : 'pointer' }}>매도</div>
          </div>
        </div>
      )}
    </div>
  );
}

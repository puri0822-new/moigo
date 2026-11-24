import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from '../context/ThemeContext';
import { FS, FW, RADIUS } from '../lib/tokens';

interface ConfirmDialogProps {
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  // 되돌릴 수 없는 행동이면 확인 버튼을 위험 색으로 보여준다
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// 삭제·취소처럼 되돌리기 어려운 행동 전에 한 번 더 묻는 확인창.
// Esc나 바깥을 누르면 취소되고, 실수로 Enter를 눌러도 실행되지 않게 처음 포커스는 "취소" 버튼에 둔다
export default function ConfirmDialog({
  title, message, confirmLabel, cancelLabel = '취소', danger = false, busy = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const { theme } = useTheme();
  const cancelRef = useRef<HTMLButtonElement>(null);
  // 부모가 3초마다 다시 그려져 onCancel이 새 함수가 돼도 리스너를 다시 달지 않게 최신 값만 들고 있는다
  const latest = useRef({ busy, onCancel });
  latest.current = { busy, onCancel };

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !latest.current.busy) latest.current.onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      onClick={() => { if (!busy) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 120,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={e => e.stopPropagation()}
        style={{
          width: 340, maxWidth: 'calc(100vw - 32px)', background: theme.panel, color: theme.text,
          border: `1px solid ${theme.border}`, borderRadius: RADIUS.xl, padding: '24px 20px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center' }}>
          <div id="confirm-dialog-title" style={{ fontSize: FS.title, fontWeight: FW.bold }}>{title}</div>
          {message && <div style={{ fontSize: FS.body, color: theme.textMuted, lineHeight: 1.6 }}>{message}</div>}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              flex: 1, padding: '12px 0', borderRadius: RADIUS.md,
              border: `1px solid ${theme.border}`, fontSize: FS.body, fontWeight: FW.medium, color: theme.text,
            }}
          >{cancelLabel}</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              flex: 1, padding: '12px 0', borderRadius: RADIUS.md, fontSize: FS.body, fontWeight: FW.semibold,
              background: danger ? theme.error : theme.ai,
              // 다크 모드 위험 색은 밝아서 흰 글자 대비가 부족하므로 배경색 글자를 쓴다
              color: danger ? theme.bg : theme.aiText,
              opacity: busy ? 0.6 : 1,
            }}
          >{busy ? '처리 중…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { deleteAllNotifications, deleteNotification, fetchNotifications, readAllNotifications } from '../../lib/api';
import type { ApiNotification } from '../../lib/api';
import { usePolling } from '../../lib/usePolling';
import { timeAgo } from '../../lib/time';
import StockLogo from '../StockLogo';
import { FS, FW, RADIUS } from '../../lib/tokens';
import Pressable from '../Pressable';
import ConfirmDialog from '../ConfirmDialog';

// 서버가 이 요청을 받을 때 급등락을 계산하므로, 계좌 갱신과 같은 30초 간격으로 확인한다
const NOTIFICATION_POLL_MS = 30_000;

export default function NotificationBell() {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = () => {
    fetchNotifications()
      .then(res => { setItems(res.data.items); setUnread(res.data.unread_count); setLoadFailed(false); })
      // 30초마다 다시 시도하므로 여기서는 실패했다는 표시만 남긴다
      .catch(() => setLoadFailed(true));
  };
  usePolling(load, NOTIFICATION_POLL_MS, isAuthenticated);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    // 열면 모두 읽음 처리. 이번에 열린 목록에서는 새 알림 표시를 그대로 둬서 어떤 게 새 것인지 보이게 한다
    if (next && unread > 0) {
      setUnread(0);
      readAllNotifications().catch(() => {});
    }
    if (!next) setItems(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeOne = (id: number) => {
    const before = items;
    setItems(prev => prev.filter(n => n.id !== id));
    setActionError('');
    deleteNotification(id).catch(() => { setItems(before); setActionError('알림을 지우지 못했어요. 다시 시도해 주세요'); });
  };

  // 되돌릴 수 없으므로 확인창에서 "삭제"를 눌렀을 때만 실행한다
  const removeAll = () => {
    setConfirmClear(false);
    setActionError('');
    const before = items;
    setItems([]);
    deleteAllNotifications().catch(() => { setItems(before); setActionError('알림을 지우지 못했어요. 다시 시도해 주세요'); });
  };

  const go = (path: string) => {
    setOpen(false);
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    navigate(path);
  };

  return (
    <div style={{ position: 'relative' }}>
      <Pressable
        onClick={toggleOpen}
        aria-label="알림"
        style={{
          width: 34, height: 34, borderRadius: RADIUS.md, border: `1px solid ${theme.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: theme.textMuted, flexShrink: 0, position: 'relative',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <div style={{
            position: 'absolute', top: 6, right: 7, width: 8, height: 8, borderRadius: '50%',
            background: theme.error, border: `2px solid ${theme.panel}`,
          }} />
        )}
      </Pressable>

      {open && (
        <>
          <div onClick={toggleOpen} style={{ position: 'fixed', inset: 0, zIndex: 15 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 340,
            background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: RADIUS.lg, boxShadow: '0 8px 24px rgba(0,0,0,.25)',
            overflow: 'hidden', zIndex: 20,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', padding: '16px 16px',
              borderBottom: `1px solid ${theme.border}`,
            }}>
              <span style={{ fontSize: FS.body, fontWeight: FW.semibold }}>알림</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                {items.length > 0 && (
                  <button type="button" onClick={() => setConfirmClear(true)} style={{ fontSize: FS.caption, color: theme.textMuted, padding: '8px 4px' }}>전체 삭제</button>
                )}
                <button type="button" onClick={() => go('/settings')} style={{ fontSize: FS.caption, color: theme.textMuted, padding: '8px 4px' }}>알림 설정</button>
              </div>
            </div>

            {(actionError || loadFailed) && (
              <div role="alert" style={{ padding: '8px 16px', fontSize: FS.caption, color: theme.error, background: theme.errorSoft }}>
                ⚠ {actionError || '알림을 불러오지 못했어요. 잠시 후 자동으로 다시 시도해요'}
              </div>
            )}

            {items.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: FS.caption, color: theme.textMuted, lineHeight: 1.7 }}>
                아직 알림이 없어요<br />
                관심 종목(♡)에서 알림을 켜면 5% 이상 오르내릴 때 알려드려요
              </div>
            ) : (
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {items.map(n => {
                  const isUp = n.direction === 'UP';
                  const color = isUp ? theme.up : theme.down;
                  return (
                    <Pressable
                      key={n.id}
                      onClick={() => go(`/stock/${n.stock_code}`)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer',
                        borderBottom: `1px solid ${theme.border}`,
                        background: n.read ? 'transparent' : theme.aiSoft,
                      }}
                    >
                      <StockLogo name={n.stock_name} code={n.stock_code} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: FS.body, fontWeight: FW.semibold }}>
                          {n.stock_name} <span style={{ color }}>{n.level}% {isUp ? '급상승' : '급하락'}</span>
                        </div>
                        <div style={{ fontSize: FS.caption, color: theme.textMuted, marginTop: 2 }}>
                          {n.price.toLocaleString()}원 · 전일 대비{' '}
                          <span style={{ color, fontWeight: FW.medium }}>{isUp ? '+' : ''}{n.change_rate.toFixed(2)}%</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <Pressable
                          onClick={e => { e.stopPropagation(); removeOne(n.id); }}
                          title="알림 삭제"
                          aria-label="알림 삭제"
                          style={{
                            width: 28, height: 28, borderRadius: RADIUS.md, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: FS.caption, color: theme.textMuted,
                          }}
                        >✕</Pressable>
                        <span style={{ fontSize: FS.caption, color: theme.textMuted }}>{timeAgo(n.created_at)}</span>
                      </div>
                    </Pressable>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {confirmClear && (
        <ConfirmDialog
          title="알림을 모두 지울까요?"
          message={`알림 ${items.length}개가 지워지고 되돌릴 수 없어요`}
          confirmLabel="모두 삭제"
          danger
          onConfirm={removeAll}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}

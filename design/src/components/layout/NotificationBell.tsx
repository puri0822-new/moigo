import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { deleteAllNotifications, deleteNotification, fetchNotifications, readAllNotifications } from '../../lib/api';
import type { ApiNotification } from '../../lib/api';
import { usePolling } from '../../lib/usePolling';
import { timeAgo } from '../../lib/time';
import StockLogo from '../StockLogo';

// 서버가 이 요청을 받을 때 급등락을 계산하므로, 계좌 갱신과 같은 30초 간격으로 확인한다
const NOTIFICATION_POLL_MS = 30_000;

export default function NotificationBell() {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = () => {
    fetchNotifications()
      .then(res => { setItems(res.data.items); setUnread(res.data.unread_count); })
      .catch(() => {});
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
    deleteNotification(id).catch(() => setItems(before));
  };

  const removeAll = () => {
    const before = items;
    setItems([]);
    deleteAllNotifications().catch(() => setItems(before));
  };

  const go = (path: string) => {
    setOpen(false);
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    navigate(path);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={toggleOpen}
        style={{
          width: 34, height: 34, borderRadius: 9, border: `1px solid ${theme.border}`,
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
            background: '#ef4444', border: `2px solid ${theme.panel}`,
          }} />
        )}
      </div>

      {open && (
        <>
          <div onClick={toggleOpen} style={{ position: 'fixed', inset: 0, zIndex: 15 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 340,
            background: theme.panel, border: `1px solid ${theme.border}`,
            borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.25)',
            overflow: 'hidden', zIndex: 20,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', padding: '14px 16px',
              borderBottom: `1px solid ${theme.border}`,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>알림</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                {items.length > 0 && (
                  <span onClick={removeAll} style={{ fontSize: 12, color: theme.textMuted, cursor: 'pointer' }}>전체 삭제</span>
                )}
                <span onClick={() => go('/settings')} style={{ fontSize: 12, color: theme.textMuted, cursor: 'pointer' }}>알림 설정</span>
              </div>
            </div>

            {items.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 12, color: theme.textMuted, lineHeight: 1.7 }}>
                아직 알림이 없어요<br />
                관심 종목(♡)에서 알림을 켜면 5% 이상 오르내릴 때 알려드려요
              </div>
            ) : (
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {items.map(n => {
                  const isUp = n.direction === 'UP';
                  const color = isUp ? theme.up : theme.down;
                  return (
                    <div
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
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                          {n.stock_name} <span style={{ color }}>{n.level}% {isUp ? '급상승' : '급하락'}</span>
                        </div>
                        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                          {n.price.toLocaleString()}원 · 전일 대비{' '}
                          <span style={{ color, fontWeight: 600 }}>{isUp ? '+' : ''}{n.change_rate.toFixed(2)}%</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <div
                          onClick={e => { e.stopPropagation(); removeOne(n.id); }}
                          title="알림 삭제"
                          style={{
                            width: 20, height: 20, borderRadius: 6, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, color: theme.textMuted,
                          }}
                        >✕</div>
                        <span style={{ fontSize: 11, color: theme.textMuted }}>{timeAgo(n.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

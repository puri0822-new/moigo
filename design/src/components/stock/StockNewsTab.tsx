import { useTheme } from '../../context/ThemeContext';
import { timeAgo } from '../../lib/time';
import type { ApiNewsItem } from '../../lib/api';

interface StockNewsTabProps {
  news: ApiNewsItem[];
  status: 'loading' | 'ready' | 'error';
}

export default function StockNewsTab({ news, status }: StockNewsTabProps) {
  const { theme } = useTheme();
  return (
    <div style={{
      background: theme.panel, border: `1px solid ${theme.border}`,
      borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>최근 뉴스</div>
      {status === 'loading' && <div style={{ fontSize: 12, color: theme.textMuted }}>뉴스를 불러오는 중...</div>}
      {status === 'error' && <div style={{ fontSize: 12, color: theme.textMuted }}>뉴스를 불러오지 못했습니다</div>}
      {status === 'ready' && news.length === 0 && <div style={{ fontSize: 12, color: theme.textMuted }}>관련 뉴스가 없습니다</div>}
      {news.map(n => (
        <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '12px 0', borderBottom: `1px solid ${theme.border}`,
          color: 'inherit', textDecoration: 'none',
        }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, lineHeight: 1.45,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{n.title}</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>{n.source ?? ''} · {timeAgo(n.published_at)}</div>
          </div>
          {n.image_url && (
            <img
              src={n.image_url} alt="" loading="lazy" referrerPolicy="no-referrer"
              onError={e => { e.currentTarget.style.display = 'none'; }}
              style={{
                width: 96, height: 64, flexShrink: 0, objectFit: 'cover',
                borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.panel2,
              }}
            />
          )}
        </a>
      ))}
    </div>
  );
}

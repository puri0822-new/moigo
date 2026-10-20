import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import StockLogo from './StockLogo';
import {
  fetchPopularPosts, fetchTrendingStocks, fetchWeeklyRanking,
  type ApiPost, type ApiTrendingStock, type ApiWeeklyRanker,
} from '../lib/api';

type Loaded<T> = { status: 'loading' | 'error' } | { status: 'ready'; items: T[] };

function useLoaded<T>(load: () => Promise<{ data: T[] }>): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    load()
      .then(res => { if (!cancelled) setState({ status: 'ready', items: res.data }); })
      .catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
  }, []);
  return state;
}

export default function FeedSidebar({ fullWidth = false }: { fullWidth?: boolean }) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const popular = useLoaded<ApiPost>(() => fetchPopularPosts(5));
  const trending = useLoaded<ApiTrendingStock>(() => fetchTrendingStocks(5));
  const weekly = useLoaded<ApiWeeklyRanker>(() => fetchWeeklyRanking(5));

  const box = (title: string, caption: string, body: React.ReactNode) => (
    <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>{title}</span>
        <span style={{ fontSize: 10, color: theme.textMuted }}>{caption}</span>
      </div>
      {body}
    </div>
  );
  const note = (text: string) => <div style={{ fontSize: 12, color: theme.textMuted, padding: '6px 0' }}>{text}</div>;
  function list<T>(state: Loaded<T>, empty: string, render: (item: T, index: number) => React.ReactNode) {
    if (state.status !== 'ready') return note(state.status === 'loading' ? '불러오는 중...' : '불러오지 못했습니다');
    if (state.items.length === 0) return note(empty);
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{state.items.map(render)}</div>;
  }
  const rankNumber = (n: number) => (
    <span style={{ width: 16, flexShrink: 0, fontSize: 12, fontWeight: 800, color: n <= 3 ? theme.ai : theme.textMuted }}>{n}</span>
  );

  return (
    <div style={{ width: fullWidth ? '100%' : 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {box('인기 글', '최근 7일', list(popular, '아직 글이 없습니다', (post, i) => (
        <div key={post.id} style={{ display: 'flex', gap: 8 }}>
          {rankNumber(i + 1)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.content}</div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
              {post.author} · 좋아요 {post.like_count} · 댓글 {post.comment_count}
            </div>
          </div>
        </div>
      )))}

      {box('많이 언급된 종목', '최근 7일', list(trending, '종목을 붙인 글이 아직 없습니다', (stock, i) => (
        <div key={stock.id} onClick={() => navigate(`/stock/${stock.code}`)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          {rankNumber(i + 1)}
          <StockLogo name={stock.name} code={stock.code} size={22} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stock.name}</span>
          <span style={{ fontSize: 11, color: theme.textMuted, flexShrink: 0 }}>글 {stock.post_count}</span>
        </div>
      )))}

      {box('주간 수익 랭킹', '최근 7일 수익금', list(weekly, '아직 사용자가 없습니다', user => {
        const color = user.profit_amount > 0 ? theme.up : user.profit_amount < 0 ? theme.down : theme.textMuted;
        return (
          <div key={user.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {rankNumber(user.rank)}
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0, fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: user.is_me ? theme.ai : theme.panel2, color: user.is_me ? theme.aiText : theme.textMuted,
              border: `1px solid ${user.is_me ? theme.ai : theme.border}`,
            }}>
              {user.nickname.slice(0, 1).toUpperCase()}
            </div>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: user.is_me ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.nickname}</span>
            <div style={{ textAlign: 'right', flexShrink: 0, color }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{user.profit_amount >= 0 ? '+' : '-'}{Math.abs(user.profit_amount).toLocaleString()}원</div>
              <div style={{ fontSize: 10 }}>({Math.abs(user.profit_rate).toFixed(2)}%)</div>
            </div>
          </div>
        );
      }))}
      <div onClick={() => navigate('/ranking')} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: theme.textMuted, cursor: 'pointer' }}>
        전체 랭킹 보기
      </div>
    </div>
  );
}

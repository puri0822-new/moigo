import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import StockLogo from './StockLogo';
import {
  createComment, createPost, deleteComment, deletePost, fetchComments, fetchPosts, fetchStocks, togglePostLike,
  type ApiComment, type ApiPost, type ApiStock,
} from '../lib/api';
import { timeAgo } from '../lib/time';

const PAGE_SIZE = 20;
const POST_MAX_LENGTH = 1000;
const COMMENT_MAX_LENGTH = 500;

interface Props {
  // 주면 그 종목 글만 보여주고, 새 글도 그 종목 글로 올린다 (종목 상세의 커뮤니티 탭).
  // 안 주면 전체 피드이고, 글을 쓸 때 종목을 골라 붙일 수 있다.
  stockId?: number;
  stockName?: string;
}

export default function PostFeed({ stockId, stockName }: Props) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [taggedStockId, setTaggedStockId] = useState<number | ''>('');
  const [stocks, setStocks] = useState<ApiStock[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  // 댓글은 글마다 펼칠 때 불러온다
  const [openPostId, setOpenPostId] = useState<number | null>(null);
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [commentsStatus, setCommentsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [commentDraft, setCommentDraft] = useState('');

  const load = useCallback(() => {
    let cancelled = false;
    setStatus('loading');
    setOpenPostId(null);
    fetchPosts({ stockId, limit: PAGE_SIZE })
      .then(res => {
        if (cancelled) return;
        setPosts(res.data);
        setHasMore(res.data.length === PAGE_SIZE);
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [stockId]);
  useEffect(() => load(), [load]);

  // 전체 피드에서만 종목을 골라 붙일 수 있다
  useEffect(() => {
    if (stockId != null) return;
    fetchStocks().then(setStocks).catch(() => {});
  }, [stockId]);

  const patchPost = (id: number, patch: Partial<ApiPost>) =>
    setPosts(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));

  const fail = (err: unknown, fallback: string) => setError(err instanceof Error ? err.message : fallback);

  const handlePost = async () => {
    const content = draft.trim();
    if (!content || posting) return;
    setPosting(true);
    setError('');
    try {
      const res = await createPost({ content, stock_id: stockId ?? (taggedStockId === '' ? null : taggedStockId) });
      setPosts(prev => [res.data, ...prev]);
      setDraft('');
      setTaggedStockId('');
    } catch (err) {
      fail(err, '글을 올리지 못했습니다');
    } finally {
      setPosting(false);
    }
  };

  const handleLoadMore = async () => {
    const last = posts[posts.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchPosts({ stockId, limit: PAGE_SIZE, beforeId: last.id });
      setPosts(prev => [...prev, ...res.data]);
      setHasMore(res.data.length === PAGE_SIZE);
    } catch (err) {
      fail(err, '글을 더 불러오지 못했습니다');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLike = async (post: ApiPost) => {
    try {
      const res = await togglePostLike(post.id);
      patchPost(post.id, { liked: res.data.liked, like_count: res.data.like_count });
    } catch (err) {
      fail(err, '좋아요를 반영하지 못했습니다');
    }
  };

  const handleDeletePost = async (post: ApiPost) => {
    if (!window.confirm('이 글을 삭제할까요?')) return;
    try {
      await deletePost(post.id);
      setPosts(prev => prev.filter(p => p.id !== post.id));
      if (openPostId === post.id) setOpenPostId(null);
    } catch (err) {
      fail(err, '글을 삭제하지 못했습니다');
    }
  };

  const toggleComments = (post: ApiPost) => {
    if (openPostId === post.id) {
      setOpenPostId(null);
      return;
    }
    setOpenPostId(post.id);
    setComments([]);
    setCommentDraft('');
    setCommentsStatus('loading');
    fetchComments(post.id)
      .then(res => {
        setComments(res.data);
        setCommentsStatus('ready');
        patchPost(post.id, { comment_count: res.data.length });
      })
      .catch(() => setCommentsStatus('error'));
  };

  const handleComment = async (post: ApiPost) => {
    const content = commentDraft.trim();
    if (!content) return;
    try {
      const res = await createComment(post.id, content);
      setComments(prev => [...prev, res.data]);
      setCommentDraft('');
      patchPost(post.id, { comment_count: post.comment_count + 1 });
    } catch (err) {
      fail(err, '댓글을 달지 못했습니다');
    }
  };

  const handleDeleteComment = async (post: ApiPost, comment: ApiComment) => {
    try {
      await deleteComment(post.id, comment.id);
      setComments(prev => prev.filter(c => c.id !== comment.id));
      patchPost(post.id, { comment_count: Math.max(0, post.comment_count - 1) });
    } catch (err) {
      fail(err, '댓글을 삭제하지 못했습니다');
    }
  };

  const card = { background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 12 };
  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const, background: theme.panel2, color: theme.text,
    border: `1px solid ${theme.border}`, borderRadius: 8, padding: '10px 12px',
    fontSize: 13, fontFamily: 'inherit', outline: 'none',
  };
  const linkButton = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 };
  const avatar = (name: string, size: number) => (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: theme.aiSoft, color: theme.ai, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 800,
    }}>
      {name.slice(0, 1)}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 글쓰기 */}
      <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          maxLength={POST_MAX_LENGTH}
          rows={3}
          placeholder={stockName ? `${stockName}에 대한 생각을 나눠보세요` : '투자 아이디어나 오늘의 매매를 나눠보세요'}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {stockId == null && (
            <select
              value={taggedStockId}
              onChange={e => setTaggedStockId(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ ...inputStyle, width: 'auto', padding: '7px 10px', fontSize: 12 }}
            >
              <option value="">종목 선택 안 함</option>
              {stocks.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: theme.textMuted }}>{draft.length}/{POST_MAX_LENGTH}</span>
          <button
            onClick={handlePost}
            disabled={!draft.trim() || posting}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 700, background: theme.ai, color: theme.aiText,
              cursor: !draft.trim() || posting ? 'default' : 'pointer', opacity: !draft.trim() || posting ? 0.5 : 1,
            }}
          >
            {posting ? '올리는 중...' : '올리기'}
          </button>
        </div>
        {error && <div style={{ fontSize: 12, color: theme.down }}>{error}</div>}
      </div>

      {/* 글 목록 */}
      {status !== 'ready' && (
        <div style={{ ...card, padding: '28px 16px', textAlign: 'center', fontSize: 13, color: theme.textMuted }}>
          {status === 'loading' ? '글을 불러오는 중...' : (
            <>
              글을 불러오지 못했습니다{' '}
              <button onClick={load} style={{ ...linkButton, fontSize: 13, color: theme.ai, fontWeight: 600 }}>다시 시도</button>
            </>
          )}
        </div>
      )}
      {status === 'ready' && posts.length === 0 && (
        <div style={{ ...card, padding: '28px 16px', textAlign: 'center', fontSize: 13, color: theme.textMuted }}>
          아직 글이 없습니다. 첫 글을 남겨보세요
        </div>
      )}
      {status === 'ready' && posts.map(post => (
        <div key={post.id} style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {avatar(post.author, 32)}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{post.author}</span>
              <span style={{ fontSize: 11, color: theme.textMuted }}>{timeAgo(post.created_at)}</span>
            </div>
            {/* 전체 피드에서는 어떤 종목에 대한 글인지 보여주고, 누르면 그 종목으로 간다 */}
            {post.stock && stockId == null && (
              <div
                onClick={() => navigate(`/stock/${post.stock!.code}`)}
                style={{
                  marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  padding: '4px 10px 4px 5px', borderRadius: 20, border: `1px solid ${theme.border}`, background: theme.panel2,
                  fontSize: 12, fontWeight: 600,
                }}
              >
                <StockLogo name={post.stock.name} code={post.stock.code} size={18} />
                {post.stock.name}
              </div>
            )}
          </div>

          <div style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{post.content}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => handleLike(post)} style={{ ...linkButton, display: 'flex', alignItems: 'center', gap: 5, color: post.liked ? '#ef4444' : theme.textMuted, fontWeight: 600 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill={post.liked ? '#ef4444' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {post.like_count}
            </button>
            <button onClick={() => toggleComments(post)} style={{ ...linkButton, display: 'flex', alignItems: 'center', gap: 5, color: openPostId === post.id ? theme.ai : theme.textMuted, fontWeight: 600 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              댓글 {post.comment_count}
            </button>
            {post.is_mine && (
              <button onClick={() => handleDeletePost(post)} style={{ ...linkButton, marginLeft: 'auto', color: theme.textMuted }}>삭제</button>
            )}
          </div>

          {openPostId === post.id && (
            <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {commentsStatus === 'loading' && <div style={{ fontSize: 12, color: theme.textMuted }}>댓글을 불러오는 중...</div>}
              {commentsStatus === 'error' && <div style={{ fontSize: 12, color: theme.textMuted }}>댓글을 불러오지 못했습니다</div>}
              {commentsStatus === 'ready' && comments.length === 0 && <div style={{ fontSize: 12, color: theme.textMuted }}>첫 댓글을 남겨보세요</div>}
              {comments.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 8 }}>
                  {avatar(c.author, 24)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{c.author}</span>
                      <span style={{ fontSize: 11, color: theme.textMuted }}>{timeAgo(c.created_at)}</span>
                      {c.is_mine && (
                        <button onClick={() => handleDeleteComment(post, c)} style={{ ...linkButton, marginLeft: 'auto', fontSize: 11, color: theme.textMuted }}>삭제</button>
                      )}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.content}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={commentDraft}
                  onChange={e => setCommentDraft(e.target.value)}
                  // 한글 입력 중 조합을 확정하는 Enter에는 반응하지 않는다
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleComment(post); }}
                  maxLength={COMMENT_MAX_LENGTH}
                  placeholder="댓글 달기"
                  style={{ ...inputStyle, padding: '8px 12px' }}
                />
                <button
                  onClick={() => handleComment(post)}
                  disabled={!commentDraft.trim()}
                  style={{
                    padding: '0 14px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'transparent',
                    color: theme.ai, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', flexShrink: 0,
                    cursor: commentDraft.trim() ? 'pointer' : 'default', opacity: commentDraft.trim() ? 1 : 0.5,
                  }}
                >
                  등록
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {status === 'ready' && hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          style={{
            padding: '10px 0', borderRadius: 10, border: `1px solid ${theme.border}`, background: 'transparent',
            color: theme.textMuted, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: loadingMore ? 'default' : 'pointer',
          }}
        >
          {loadingMore ? '불러오는 중...' : '더 보기'}
        </button>
      )}
    </div>
  );
}

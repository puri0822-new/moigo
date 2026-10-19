import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import StockLogo from './StockLogo';
import {
  assetUrl, createComment, createPost, deleteComment, deletePost, fetchComments, fetchPosts, fetchStocks, togglePostLike, updatePost, uploadPostImage,
  type ApiComment, type ApiPost, type ApiStock, type PostSort,
} from '../lib/api';
import { timeAgo } from '../lib/time';

const PAGE_SIZE = 20;
const SORTS: [PostSort, string][] = [['popular', '인기순'], ['latest', '최신순'], ['oldest', '오래된순']];
const POST_MAX_LENGTH = 1000;
const COMMENT_MAX_LENGTH = 500;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface Props {
  // 주면 그 종목 글만 보여주고, 새 글도 그 종목 글로 올린다 (종목 상세의 커뮤니티 탭).
  // 안 주면 전체 피드이고, 글을 쓸 때 종목을 골라 붙일 수 있다.
  stockId?: number;
  stockName?: string;
}

export default function PostFeed({ stockId, stockName }: Props) {
  const { theme } = useTheme();
  const { nickname } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [sort, setSort] = useState<PostSort>('latest');
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [taggedStockId, setTaggedStockId] = useState<number | ''>('');
  const [stocks, setStocks] = useState<ApiStock[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  // 글쓰기 창. 닫아도 쓰던 내용은 남겨 두고, 글을 올렸을 때만 비운다
  const [composerOpen, setComposerOpen] = useState(false);
  const [composeError, setComposeError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 글 수정: 같은 창을 쓰되, 쓰다 만 새 글은 치워 뒀다가 수정이 끝나면 되돌린다
  const [editingPost, setEditingPost] = useState<ApiPost | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null); // 수정 중인 글에 이미 붙어 있는 사진
  const stashedDraft = useRef<{ draft: string; taggedStockId: number | ''; imageFile: File | null } | null>(null);
  const [menuPostId, setMenuPostId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  // 댓글은 글마다 펼칠 때 불러온다
  const [openPostId, setOpenPostId] = useState<number | null>(null);
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [commentsStatus, setCommentsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [commentDraft, setCommentDraft] = useState('');

  const load = useCallback(() => {
    let cancelled = false;
    setStatus('loading');
    setOpenPostId(null);
    fetchPosts({ stockId, limit: PAGE_SIZE, sort })
      .then(res => {
        if (cancelled) return;
        setPosts(res.data);
        setHasMore(res.data.length === PAGE_SIZE);
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [stockId, sort]);
  useEffect(() => load(), [load]);

  // 전체 피드에서만 종목을 골라 붙일 수 있다
  useEffect(() => {
    if (stockId != null) return;
    fetchStocks().then(setStocks).catch(() => {});
  }, [stockId]);

  const patchPost = (id: number, patch: Partial<ApiPost>) =>
    setPosts(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));

  const fail = (err: unknown, fallback: string) => setError(err instanceof Error ? err.message : fallback);

  // 미리보기용 주소는 사진이 바뀌거나 화면을 떠날 때 해제한다
  useEffect(() => {
    if (!imageFile) { setImagePreview(null); return; }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handlePickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 다시 골라도 onChange가 불리게
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) { setComposeError('JPG, PNG, WebP 사진만 올릴 수 있습니다'); return; }
    if (file.size > IMAGE_MAX_BYTES) { setComposeError('사진은 5MB 이하만 올릴 수 있습니다'); return; }
    setComposeError('');
    setImageFile(file);
  };

  const openEditor = (post: ApiPost) => {
    stashedDraft.current = { draft, taggedStockId, imageFile };
    setEditingPost(post);
    setDraft(post.content);
    setTaggedStockId(post.stock?.id ?? '');
    setImageFile(null);
    setExistingImage(post.image_url);
    setComposeError('');
    setComposerOpen(true);
  };

  const closeComposer = () => {
    if (editingPost) {
      const stash = stashedDraft.current;
      setDraft(stash?.draft ?? '');
      setTaggedStockId(stash?.taggedStockId ?? '');
      setImageFile(stash?.imageFile ?? null);
      setExistingImage(null);
      setEditingPost(null);
      stashedDraft.current = null;
    }
    setComposerOpen(false);
  };

  const handlePost = async () => {
    const content = draft.trim();
    if (!content || posting) return;
    setPosting(true);
    setComposeError('');
    try {
      const image_url = imageFile ? await uploadPostImage(imageFile) : existingImage;
      const stock_id = stockId ?? (taggedStockId === '' ? null : taggedStockId);
      if (editingPost) {
        const res = await updatePost(editingPost.id, { content, stock_id, image_url });
        patchPost(editingPost.id, res.data);
        closeComposer();
      } else {
        const res = await createPost({ content, stock_id, image_url });
        // 새 글은 최신순 맨 위에서 보이게 한다 (다른 정렬이면 최신순으로 바꿔 다시 불러온다)
        if (sort === 'latest') setPosts(prev => [res.data, ...prev]);
        else setSort('latest');
        setDraft('');
        setTaggedStockId('');
        setImageFile(null);
        setComposerOpen(false);
      }
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : editingPost ? '글을 수정하지 못했습니다' : '글을 올리지 못했습니다');
    } finally {
      setPosting(false);
    }
  };

  const handleLoadMore = async () => {
    const last = posts[posts.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchPosts(
        sort === 'latest'
          ? { stockId, limit: PAGE_SIZE, sort, beforeId: last.id }
          : { stockId, limit: PAGE_SIZE, sort, offset: posts.length },
      );
      // 그 사이 순서가 바뀌어 이미 받은 글이 다시 올 수 있어 걸러낸다
      setPosts(prev => [...prev, ...res.data.filter(p => !prev.some(q => q.id === p.id))]);
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

  const handleDeletePost = async () => {
    const post = deleteTarget;
    if (!post || deleting) return;
    setDeleting(true);
    try {
      await deletePost(post.id);
      setPosts(prev => prev.filter(p => p.id !== post.id));
      if (openPostId === post.id) setOpenPostId(null);
    } catch (err) {
      fail(err, '글을 삭제하지 못했습니다');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
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
      {/* 정렬 */}
      <div style={{ display: 'flex', gap: 6 }}>
        {SORTS.map(([key, label]) => (
          <div
            key={key}
            onClick={() => setSort(key)}
            style={{
              fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
              background: sort === key ? theme.ai : theme.panel2,
              color: sort === key ? '#fff' : theme.textMuted,
              border: `1px solid ${sort === key ? theme.ai : theme.border}`,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 글쓰기 창 열기: 입력창처럼 생긴 바를 누르면 작성 창이 뜬다 */}
      <div
        onClick={() => { setComposeError(''); setComposerOpen(true); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          padding: 6, borderRadius: 999,
          background: theme.panel, border: `1px solid ${theme.border}`,
        }}
      >
        {avatar(nickname || '?', 34)}
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {draft.trim() ? draft : stockName ? `${stockName}에 대한 생각을 나눠보세요` : '투자 아이디어나 오늘의 매매를 나눠보세요'}
        </span>
        <span style={{
          flexShrink: 0, padding: '8px 16px', borderRadius: 999,
          background: theme.ai, color: theme.aiText, fontSize: 13, fontWeight: 700,
        }}>
          피드 남기기
        </span>
      </div>
      {error && <div style={{ fontSize: 12, color: theme.down }}>{error}</div>}

      {composerOpen && (
        <div
          onClick={() => { if (!posting) closeComposer(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 520, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
              background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 20,
              boxShadow: '0 16px 48px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{editingPost ? '글 수정' : stockName ? `${stockName} 글 작성` : '글 작성'}</span>
              <div
                onClick={() => { if (!posting) closeComposer(); }}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: `1px solid ${theme.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: theme.textMuted, fontSize: 13,
                }}
              >✕</div>
            </div>

            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              maxLength={POST_MAX_LENGTH}
              rows={7}
              placeholder={stockName ? `${stockName}에 대한 생각을 나눠보세요` : '투자 아이디어나 오늘의 매매를 나눠보세요'}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />

            {(imagePreview || existingImage) && (
              <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
                <img src={imagePreview ?? assetUrl(existingImage!)} alt="" style={{ display: 'block', maxWidth: '100%', maxHeight: 220, borderRadius: 10, border: `1px solid ${theme.border}` }} />
                <div
                  onClick={() => { setImageFile(null); setExistingImage(null); }}
                  title="사진 빼기"
                  style={{
                    position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >✕</div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input ref={fileInputRef} type="file" accept={IMAGE_TYPES.join(',')} onChange={handlePickImage} style={{ display: 'none' }} />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8,
                  border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted,
                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                </svg>
                {imageFile || existingImage ? '사진 바꾸기' : '사진 추가'}
              </button>
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
            </div>

            {composeError && <div style={{ fontSize: 12, color: theme.down }}>{composeError}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={closeComposer}
                disabled={posting}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'transparent',
                  color: theme.textMuted, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: posting ? 'default' : 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handlePost}
                disabled={!draft.trim() || posting}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 8, border: 'none', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 700, background: theme.ai, color: theme.aiText,
                  cursor: !draft.trim() || posting ? 'default' : 'pointer', opacity: !draft.trim() || posting ? 0.5 : 1,
                }}
              >
                {posting ? (editingPost ? '수정하는 중...' : '올리는 중...') : editingPost ? '수정하기' : '올리기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 */}
      {deleteTarget && (
        <div
          onClick={() => { if (!deleting) setDeleteTarget(null); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 340, maxWidth: 'calc(100vw - 32px)',
              background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '24px 20px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 14,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, textAlign: 'center' }}>게시물을 삭제할까요?</div>
            <div style={{ fontSize: 13, color: theme.textMuted, textAlign: 'center', lineHeight: 1.6 }}>
              삭제하면 좋아요와 댓글도 함께 사라지고 되돌릴 수 없습니다.
            </div>
            <div style={{
              background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 12px',
              fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {deleteTarget.content}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'transparent',
                  color: theme.textMuted, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: deleting ? 'default' : 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleDeletePost}
                disabled={deleting}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff',
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? '삭제하는 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* 전체 피드에서는 어떤 종목에 대한 글인지 보여주고, 누르면 그 종목으로 간다 */}
              {post.stock && stockId == null && (
                <div
                  onClick={() => navigate(`/stock/${post.stock!.code}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    padding: '4px 10px 4px 5px', borderRadius: 20, border: `1px solid ${theme.border}`, background: theme.panel2,
                    fontSize: 12, fontWeight: 600,
                  }}
                >
                  <StockLogo name={post.stock.name} code={post.stock.code} size={18} />
                  {post.stock.name}
                </div>
              )}
              {post.is_mine && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setMenuPostId(menuPostId === post.id ? null : post.id)}
                    title="더 보기"
                    style={{
                      width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer', color: theme.textMuted,
                      background: menuPostId === post.id ? theme.panel2 : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
                    </svg>
                  </button>
                  {menuPostId === post.id && (
                    <>
                      <div onClick={() => setMenuPostId(null)} style={{ position: 'fixed', inset: 0, zIndex: 15 }} />
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 20, minWidth: 120,
                        background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 10,
                        boxShadow: '0 8px 24px rgba(0,0,0,.25)', overflow: 'hidden',
                      }}>
                        <div
                          onClick={() => { setMenuPostId(null); openEditor(post); }}
                          style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', borderBottom: `1px solid ${theme.border}` }}
                        >
                          게시물 수정
                        </div>
                        <div
                          onClick={() => { setMenuPostId(null); setError(''); setDeleteTarget(post); }}
                          style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', color: '#ef4444' }}
                        >
                          게시물 삭제
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{post.content}</div>

          {post.image_url && (
            <a href={assetUrl(post.image_url)} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
              <img
                src={assetUrl(post.image_url)} alt="" loading="lazy"
                style={{ display: 'block', maxWidth: '100%', maxHeight: 420, borderRadius: 10, border: `1px solid ${theme.border}` }}
              />
            </a>
          )}

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

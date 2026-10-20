import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string ?? 'http://localhost:8000/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// --- 기본 fetch 헬퍼 (주문/계좌 등 기존 기능용) ---
async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !body.success) {
    throw new Error(body.message || '요청에 실패했습니다');
  }
  return body;
}

export function apiGet<T>(path: string) {
  return request<T>(path);
}

export function apiPost<T>(path: string, data?: unknown) {
  return request<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined });
}

export function apiPut<T>(path: string, data?: unknown) {
  return request<T>(path, { method: 'PUT', body: data !== undefined ? JSON.stringify(data) : undefined });
}

export function apiPatch<T>(path: string, data?: unknown) {
  return request<T>(path, { method: 'PATCH', body: data !== undefined ? JSON.stringify(data) : undefined });
}

export function apiDelete<T>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

// --- 주문 ---
export interface OrderRequest {
  stock_id: number;
  order_type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
}

export interface OrderResult {
  id: number;
  stock_name: string;
  order_type: string;
  quantity: number;
  price: number;
  total_amount: number;
  ordered_at: string;
}

export function createOrder(body: OrderRequest) {
  return apiPost<OrderResult>('/orders', body);
}

// --- 계좌 ---
export interface AccountInfo {
  id: number;
  balance: number;
  initial_balance: number;
  total_profit_loss: number;
  profit_loss_rate: number;
}

export function getAccount() {
  return apiGet<AccountInfo>('/account');
}

// --- 종목 (실시간 가격 포함) ---
export interface ApiStock {
  id: number;
  code: string;
  name: string;
  market: string;
  sector: string | null;
  current_price: number | null;
  change_rate: number | null;
  volume: number | null;
}

export async function fetchStocks(): Promise<ApiStock[]> {
  const res = await api.get<ApiResponse<ApiStock[]>>('/stocks');
  return res.data.data;
}

export async function fetchStockByCode(code: string): Promise<ApiStock | null> {
  try {
    const res = await api.get<ApiResponse<ApiStock>>(`/stocks/by-code/${code}`);
    return res.data.data;
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) return null;
    throw e;
  }
}

// --- 뉴스 ---
export interface ApiNewsItem {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  source: string | null;
  published_at: string;
  image_url: string | null;
}

export async function fetchStockNews(stockId: number, limit = 10): Promise<ApiNewsItem[]> {
  const res = await api.get<ApiResponse<ApiNewsItem[]>>(`/stocks/${stockId}/news`, { params: { limit } });
  return res.data.data;
}

// --- 캔들 차트 ---
export interface ApiCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchStockCandles(stockId: number, interval: '1m' | '1d', count: number): Promise<ApiCandle[]> {
  const res = await api.get<ApiResponse<ApiCandle[]>>(`/stocks/${stockId}/candles`, { params: { interval, count } });
  return res.data.data;
}

// --- 호가 ---
export interface ApiOrderbookLevel {
  price: number;
  volume: number; // 잔량
}

export interface ApiOrderbook {
  timestamp: string;
  // 둘 다 현재가에 가까운 호가부터: asks(매도)는 낮은 가격순, bids(매수)는 높은 가격순
  asks: ApiOrderbookLevel[];
  bids: ApiOrderbookLevel[];
}

export async function fetchStockOrderbook(stockId: number): Promise<ApiOrderbook> {
  const res = await api.get<ApiResponse<ApiOrderbook>>(`/stocks/${stockId}/orderbook`);
  return res.data.data;
}

// --- 커뮤니티 (피드) ---
export interface ApiPost {
  id: number;
  author: string; // 작성자 닉네임
  is_mine: boolean;
  content: string;
  image_url: string | null; // 붙인 사진의 서버 경로(/uploads/...). assetUrl로 감싸서 쓴다
  stock: { id: number; code: string; name: string } | null; // 특정 종목에 대한 글이면 그 종목
  like_count: number;
  comment_count: number;
  liked: boolean; // 내가 좋아요를 눌렀는지
  created_at: string;
}

export interface ApiComment {
  id: number;
  author: string;
  is_mine: boolean;
  content: string;
  created_at: string;
}

export type PostSort = 'latest' | 'oldest' | 'popular';

/** stockId를 주면 그 종목 글만. 이어 받기는 최신순이면 beforeId(그보다 오래된 글), 오래된순·인기순이면 offset(이미 받은 글 수) */
export function fetchPosts({ stockId, limit, beforeId, sort, offset }: { stockId?: number; limit?: number; beforeId?: number; sort?: PostSort; offset?: number } = {}) {
  const params = new URLSearchParams();
  if (sort != null) params.set('sort', sort);
  if (offset) params.set('offset', String(offset));
  if (stockId != null) params.set('stock_id', String(stockId));
  if (limit != null) params.set('limit', String(limit));
  if (beforeId != null) params.set('before_id', String(beforeId));
  const query = params.toString();
  return apiGet<ApiPost[]>(`/posts${query ? `?${query}` : ''}`);
}

/** 서버가 준 파일 경로(/uploads/...)를 브라우저에서 열 수 있는 주소로 바꾼다 */
export function assetUrl(path: string) {
  return new URL(path, API_BASE_URL).href;
}

/** 글에 붙일 사진을 올리고 서버 경로를 받는다. 받은 경로를 createPost의 image_url로 보낸다 */
export async function uploadPostImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const token = localStorage.getItem('access_token');
  // Content-Type은 브라우저가 multipart 경계와 함께 직접 붙이도록 지정하지 않는다
  const res = await fetch(`${API_BASE_URL}/posts/images`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const body = (await res.json()) as ApiResponse<{ image_url: string }>;
  if (!res.ok || !body.success) throw new Error(body.message || '사진을 올리지 못했습니다');
  return body.data.image_url;
}

export function createPost(body: { content: string; stock_id?: number | null; image_url?: string | null }) {
  return apiPost<ApiPost>('/posts', body);
}

/** 내 글의 내용·종목·사진을 보낸 값으로 바꾼다. image_url을 null로 보내면 사진을 뺀다 */
export function updatePost(postId: number, body: { content: string; stock_id: number | null; image_url: string | null }) {
  return apiPut<ApiPost>(`/posts/${postId}`, body);
}

export function deletePost(postId: number) {
  return apiDelete<null>(`/posts/${postId}`);
}

/** 좋아요를 누르지 않았으면 누르고, 이미 눌렀으면 취소한다 */
export function togglePostLike(postId: number) {
  return apiPost<{ liked: boolean; like_count: number }>(`/posts/${postId}/like`);
}

export function fetchComments(postId: number) {
  return apiGet<ApiComment[]>(`/posts/${postId}/comments`);
}

export function createComment(postId: number, content: string) {
  return apiPost<ApiComment>(`/posts/${postId}/comments`, { content });
}

export function deleteComment(postId: number, commentId: number) {
  return apiDelete<null>(`/posts/${postId}/comments/${commentId}`);
}

// --- 피드 사이드바 ---
/** 최근 7일 글 중 좋아요(같으면 댓글)가 많은 순 */
export function fetchPopularPosts(limit = 5) {
  return apiGet<ApiPost[]>(`/posts/popular?limit=${limit}`);
}

export interface ApiTrendingStock {
  id: number;
  code: string;
  name: string;
  post_count: number; // 최근 7일 동안 달린 글 수
}

export function fetchTrendingStocks(limit = 5) {
  return apiGet<ApiTrendingStock[]>(`/posts/trending-stocks?limit=${limit}`);
}

export interface ApiWeeklyRanker {
  rank: number;
  user_id: number;
  nickname: string;
  profit_amount: number; // 최근 7일 동안 번 금액
  profit_rate: number; // 7일 전 총 자산 대비 %
  is_me: boolean;
}

export function fetchWeeklyRanking(limit = 5) {
  return apiGet<ApiWeeklyRanker[]>(`/ranking/weekly?limit=${limit}`);
}

// ── 관심 종목 · 급등락 알림 ──

export interface ApiWatchItem {
  stock_id: number;
  stock_code: string;
  stock_name: string;
  alert_enabled: boolean;
  /** 토스 조회에 실패하면 null */
  current_price: number | null;
  change: number | null;
  change_rate: number | null;
}

export interface ApiWatchlist {
  /** 회원 설정의 급등락 알림 전체 스위치 */
  price_alert_enabled: boolean;
  items: ApiWatchItem[];
}

export function fetchWatchlist() {
  return apiGet<ApiWatchlist>('/watchlist');
}

export function addWatchlist(stockId: number, alertEnabled = false) {
  return apiPost<null>('/watchlist', { stock_id: stockId, alert_enabled: alertEnabled });
}

export function setWatchAlert(stockId: number, alertEnabled: boolean) {
  return apiPatch<null>(`/watchlist/${stockId}`, { alert_enabled: alertEnabled });
}

export function removeWatchlist(stockId: number) {
  return apiDelete<null>(`/watchlist/${stockId}`);
}

export interface ApiNotification {
  id: number;
  stock_code: string;
  stock_name: string;
  direction: 'UP' | 'DOWN';
  /** 넘은 단계(5, 10, 15...) */
  level: number;
  change_rate: number;
  price: number;
  created_at: string;
  read: boolean;
}

export function fetchNotifications() {
  return apiGet<{ unread_count: number; items: ApiNotification[] }>('/notifications');
}

export function readAllNotifications() {
  return apiPost<null>('/notifications/read-all');
}

export function deleteNotification(id: number) {
  return apiDelete<null>(`/notifications/${id}`);
}

export function deleteAllNotifications() {
  return apiDelete<null>('/notifications');
}

// ── 종목 상세 AI 인사이트 ──

export interface ApiStockAiReason {
  ai_model: string;
  trade_date: string;
  change_rate: number;
  reason: string;
  created_at: string;
}

/** 오늘 등락 이유. 없거나 오래됐으면 서버가 이 요청에서 AI로 새로 써서 몇 초 걸릴 수 있다 */
export function fetchStockAiReason(code: string) {
  return apiGet<ApiStockAiReason | null>(`/ai/stocks/${code}/reason`);
}

/** 같은 업종 종목 (이름·코드만) */
export function fetchSimilarStocks(stockId: number) {
  return apiGet<ApiStock[]>(`/stocks/${stockId}/similar`);
}

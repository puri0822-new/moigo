import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string ?? 'http://localhost:8000/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
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

export function apiDelete<T>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

// --- 주문 ---
export interface OrderRequest {
  stock_id: number;
  order_type: 'BUY' | 'SELL';
  price_type: 'MARKET' | 'LIMIT';
  quantity: number;
  // 지정가일 때의 한도 가격. 체결가는 서버가 호가로 정하고, 지금 체결되지 않으면 미체결 주문으로 남는다
  price?: number;
}

export type OrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED' | 'EXPIRED';

export interface ApiOrder {
  id: number;
  stock_name: string;
  stock_code: string;
  order_type: 'BUY' | 'SELL';
  price_type: 'MARKET' | 'LIMIT';
  // PENDING: 미체결(지정가에 닿으면 체결), EXPIRED: 장 마감까지 체결되지 않아 만료
  status: OrderStatus;
  quantity: number;
  // 체결된 주문은 평균 체결가·실제 체결 금액, 미체결 주문은 지정가·지정가 기준 금액
  price: number;
  total_amount: number;
  limit_price: number | null;
  ordered_at: string;
  filled_at: string | null;
}

/** 시장가는 호가로 즉시 체결되고, 지정가는 지금 체결되지 않으면 status가 PENDING인 채로 돌아온다 */
export function createOrder(body: OrderRequest) {
  return apiPost<ApiOrder>('/orders', body);
}

/** 내 주문 내역 (최신순, 미체결·취소·만료 포함) */
export function getOrders() {
  return apiGet<ApiOrder[]>('/orders');
}

/** 미체결 주문 취소 */
export function cancelOrder(orderId: number) {
  return apiDelete<ApiOrder>(`/orders/${orderId}`);
}

// --- 포트폴리오 ---
export interface ApiHolding {
  stock_id: number;
  stock_name: string;
  stock_code: string;
  quantity: number;
  orderable_quantity: number; // 미체결 매도 주문에 묶인 수량을 뺀, 지금 팔 수 있는 수량
  avg_price: number;
  current_price: number;
  eval_amount: number;
  profit_loss: number;
  profit_loss_rate: number; // % 단위
}

export interface ApiPortfolio {
  balance: number; // 가상 현금
  orderable_balance: number; // 미체결 매수 주문에 묶인 금액을 뺀, 지금 주문할 수 있는 금액
  total_eval_amount: number; // 보유 주식 평가액 (현재가 기준)
  total_profit_loss: number; // 보유 주식 평가손익
  total_profit_loss_rate: number; // % 단위
  holdings: ApiHolding[];
}

export function getPortfolio() {
  return apiGet<ApiPortfolio>('/portfolio');
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
  volume?: number | null;
}

export async function fetchStocks(): Promise<ApiStock[]> {
  const res = await api.get<ApiResponse<ApiStock[]>>('/stocks');
  return res.data.data;
}

export interface ApiStockDetail extends ApiStock {
  volume: number | null; // 오늘 누적 거래량
}

export async function fetchStockByCode(code: string): Promise<ApiStockDetail | null> {
  try {
    const res = await api.get<ApiResponse<ApiStockDetail>>(`/stocks/by-code/${code}`);
    return res.data.data;
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) return null;
    throw e;
  }
}

// --- 거래대금 랭킹 ---
export interface ApiStockRanking extends ApiStock {
  rank: number | null; // 거래대금 상위 100위 밖이면 실제 순위가 없어 null
  trading_volume: number | null; // 오늘 누적 거래량
  trading_amount: number | null;
}

/** 오늘 누적 거래대금 순. 100위 안의 종목이 실제 순위대로 앞에 오고, 100위 밖 종목이 뒤에 붙는다. */
export async function fetchStockRankings(): Promise<ApiStockRanking[]> {
  const res = await api.get<ApiResponse<ApiStockRanking[]>>('/stocks/rankings');
  return res.data.data;
}

// --- 뉴스 ---
export interface ApiNewsItem {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  source: string | null;
  published_at: string;
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

export async function fetchStockCandles(stockId: number, interval: '1m' | '1d' | '1w' | '1mo' | '1y', count: number): Promise<ApiCandle[]> {
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

// --- 종목 기본 정보 ---
export interface ApiStockInfo {
  english_name: string | null;
  isin_code: string | null;
  market: string | null;
  security_type: string | null;
  is_common_share: boolean | null;
  status: string | null;
  currency: string | null;
  list_date: string | null; // YYYY-MM-DD
  shares_outstanding: number | null; // 상장주식수
  nxt_supported: boolean | null;
  trading_suspended: boolean | null;
}

export async function fetchStockInfo(stockId: number): Promise<ApiStockInfo> {
  const res = await api.get<ApiResponse<ApiStockInfo>>(`/stocks/${stockId}/info`);
  return res.data.data;
}

// --- 지수 ---
export interface ApiMarketIndex {
  code: string; // KOSPI / KOSDAQ
  name: string;
  value: number;
  change: number; // 전일 대비 포인트
  change_rate: number; // 전일 대비 등락률 (0.01 = 1%)
  prev_close: number;
  is_open: boolean;
  traded_at: string;
  spark: number[]; // 당일(휴장일이면 마지막 거래일) 10분 간격 추이
}

export async function fetchMarketIndices(): Promise<ApiMarketIndex[]> {
  const res = await api.get<ApiResponse<ApiMarketIndex[]>>('/market/indices');
  return res.data.data;
}

// --- 커뮤니티 (피드) ---
export interface ApiPost {
  id: number;
  author: string; // 작성자 닉네임
  is_mine: boolean;
  content: string;
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

/** 최신순. stockId를 주면 그 종목 글만, beforeId를 주면 그보다 오래된 글을 이어서 받는다 */
export function fetchPosts({ stockId, limit, beforeId }: { stockId?: number; limit?: number; beforeId?: number } = {}) {
  const params = new URLSearchParams();
  if (stockId != null) params.set('stock_id', String(stockId));
  if (limit != null) params.set('limit', String(limit));
  if (beforeId != null) params.set('before_id', String(beforeId));
  const query = params.toString();
  return apiGet<ApiPost[]>(`/posts${query ? `?${query}` : ''}`);
}

export function createPost(body: { content: string; stock_id?: number | null }) {
  return apiPost<ApiPost>('/posts', body);
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

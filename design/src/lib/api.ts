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

// --- 주문 ---
export interface OrderRequest {
  stock_id: number;
  order_type: 'BUY' | 'SELL';
  price_type: 'MARKET' | 'LIMIT';
  quantity: number;
  // 지정가일 때의 한도 가격. 체결가는 항상 서버의 현재가다 (지정가 조건이 지금 맞지 않으면 주문이 거절된다)
  price?: number;
}

export interface OrderResult {
  id: number;
  stock_name: string;
  order_type: string;
  quantity: number;
  price: number; // 실제 체결가
  total_amount: number;
  ordered_at: string;
}

export function createOrder(body: OrderRequest) {
  return apiPost<OrderResult>('/orders', body);
}

export interface ApiOrder {
  id: number;
  stock_name: string;
  stock_code: string;
  order_type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total_amount: number;
  ordered_at: string;
}

/** 내 주문 내역 (최신순) */
export function getOrders() {
  return apiGet<ApiOrder[]>('/orders');
}

// --- 포트폴리오 ---
export interface ApiHolding {
  stock_id: number;
  stock_name: string;
  stock_code: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  eval_amount: number;
  profit_loss: number;
  profit_loss_rate: number; // % 단위
}

export interface ApiPortfolio {
  balance: number; // 가상 현금
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

export async function fetchStockCandles(stockId: number, interval: '1m' | '1d', count: number): Promise<ApiCandle[]> {
  const res = await api.get<ApiResponse<ApiCandle[]>>(`/stocks/${stockId}/candles`, { params: { interval, count } });
  return res.data.data;
}

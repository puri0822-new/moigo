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

export interface ApiStockRanking {
  rank: number | null;
  id: number;
  code: string;
  name: string;
  market: string;
  sector: string | null;
  current_price: number | null;
  change_rate: number | null;
  trading_volume: number | null;
  trading_amount: number | null;
}

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

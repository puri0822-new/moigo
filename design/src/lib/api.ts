const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

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

// --- 종목 ---
export interface StockInfo {
  id: number;
  code: string;
  name: string;
  market: string;
  sector: string;
}

export function getStocks() {
  return apiGet<StockInfo[]>('/stocks');
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

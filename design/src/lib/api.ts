import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/v1',
});

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

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

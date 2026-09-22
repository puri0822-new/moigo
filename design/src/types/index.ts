export interface NewsItem {
  title: string;
  source: string;
  time: string;
}

export interface Stock {
  rank: number;
  name: string;
  code: string;
  price: string;
  volume: string;
  changePct: number;
  aiReason: string;
  aiComment: string;
  similar: string[];
  news: NewsItem[];
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

export interface ApiNewsItem {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  source: string | null;
  published_at: string;
}

export interface ApiCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketIndex {
  name: string;
  value: string;
  changePct: number;
  changePoint: string;
}

export interface Holding {
  name: string;
  qty: string;
  changePct: number;
}

export interface AIRec {
  bot: string;
  stockName: string;
  reason: string;
}

export interface OrderbookEntry {
  price: string;
  qty: string;
  dir: 'up' | 'down' | 'mid';
}

export interface Theme {
  bg: string;
  panel: string;
  panel2: string;
  border: string;
  text: string;
  textMuted: string;
  up: string;
  down: string;
  ai: string;
}

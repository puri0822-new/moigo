export interface NewsItem {
  title: string;
  source: string;
  time: string;
}

export interface Stock {
  rank: number;
  name: string;
  code: string;
  sector: string;
  price: string;
  volume: string;
  changePct: number;
  aiReason: string;
  aiComment: string;
  similar: string[];
  news: NewsItem[];
}

export interface MarketIndex {
  name: string;
  value: string;
  changePct: number;
  changePoint: string;
  spark: number[];
}

export interface Holding {
  name: string;
  qty: string;
  changePct: number;
}

export interface AIRec {
  bot: string;
  icon: string;
  stockName: string;
  reason: string;
  signal: '매수' | '매도' | '중립';
}

export interface AIInsight {
  bot: string;
  icon: string;
  stockName: string;
  comment: string;
  signal: '매수' | '매도' | '중립';
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
  aiSoft: string;
  aiText: string;
}

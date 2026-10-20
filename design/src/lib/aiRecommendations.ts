// AI 종목 추천 (GET /ai/recommendations). 서버가 평일 장 마감 뒤 하루 한 번 만들고, 1주·1달 뒤 종가로 채점한다.
import { useEffect, useState } from 'react';
import { apiGet } from './api';
import type { AiModel } from './aiModels';

export type PeriodType = 'WEEKLY' | 'MONTHLY';
export type Opinion = 'BUY' | 'SELL';

// 추천의 근거로 쓴 뉴스 (ai_recommendation_evidence)
export interface AiEvidence {
  title: string;
  source: string;
  publishedAt: string;
  url?: string;
  // 이 뉴스가 추천에 어떻게 반영됐는지
  insight: string;
}

// 검증 결과 (ai_recommendation_results). 검증 전이면 없다
export interface AiRecommendationResult {
  priceAtEvaluation: number;
  // (검증가 - 추천가) / 추천가. 0.0123 = +1.23%
  returnRate: number;
  isHit: boolean;
  // 틀렸을 때 AI가 뉴스를 근거로 설명한 이유
  failureReason?: string;
  evaluatedAt: string;
}

export interface AiRecommendation {
  id: number;
  aiModel: AiModel;
  periodType: PeriodType;
  stockCode: string;
  stockName: string;
  sector: string;
  opinion: Opinion;
  // AI가 1~2줄로 요약한 추천 이유
  reason: string;
  // 대시보드 종목명 옆에 쓰는 25자 안팎 한 줄 요약 (없으면 reason을 쓴다)
  summary?: string;
  // AI가 매긴 확신도 (0~100)
  confidence?: number;
  evidence: AiEvidence[];
  priceAtRecommendation: number;
  recommendedAt: string;
  // 이 날짜에 그때 가격과 비교해 적중 여부를 검증한다 (주간은 1주 뒤, 월간은 1달 뒤)
  evaluateAt: string;
  result?: AiRecommendationResult;
}

interface ApiAiRecommendation {
  id: number;
  ai_model: string;
  period_type: PeriodType;
  stock_code: string;
  stock_name: string;
  sector: string | null;
  opinion: Opinion;
  reason: string;
  summary: string | null;
  confidence: number | null;
  price_at_recommendation: number;
  recommended_at: string;
  evaluate_at: string;
  evidence: { title: string; source: string | null; url: string | null; published_at: string | null; insight: string }[];
  result: {
    price_at_evaluation: number;
    return_rate: number;
    is_hit: boolean;
    failure_reason: string | null;
    evaluated_at: string;
  } | null;
}

function fromApi(r: ApiAiRecommendation): AiRecommendation {
  return {
    id: r.id,
    aiModel: r.ai_model,
    periodType: r.period_type,
    stockCode: r.stock_code,
    stockName: r.stock_name,
    sector: r.sector ?? '기타',
    opinion: r.opinion,
    reason: r.reason,
    summary: r.summary ?? undefined,
    confidence: r.confidence ?? undefined,
    evidence: r.evidence.map(e => ({
      title: e.title,
      // 언론사 대신 기사 주소의 도메인이 온다 (www.는 뺀다)
      source: (e.source ?? '').replace(/^www\./, ''),
      publishedAt: e.published_at ?? r.recommended_at,
      url: e.url ?? undefined,
      insight: e.insight,
    })),
    priceAtRecommendation: r.price_at_recommendation,
    recommendedAt: r.recommended_at,
    evaluateAt: r.evaluate_at,
    result: r.result ? {
      priceAtEvaluation: r.result.price_at_evaluation,
      returnRate: r.result.return_rate,
      isHit: r.result.is_hit,
      failureReason: r.result.failure_reason ?? undefined,
      evaluatedAt: r.result.evaluated_at,
    } : undefined,
  };
}

export interface AiRecommendations {
  status: 'loading' | 'ready' | 'error';
  // 아직 검증 전인 추천 (최근 것부터)
  current: AiRecommendation[];
  // 검증이 끝난 추천
  past: AiRecommendation[];
}

// 여러 컴포넌트가 동시에 불러도 요청은 한 번만 보낸다. 추천은 하루 한 번 바뀌므로 페이지에 머무는 동안은 다시 부르지 않는다
let cache: AiRecommendation[] | null = null;
let pending: Promise<AiRecommendation[]> | null = null;

function load(): Promise<AiRecommendation[]> {
  pending ??= apiGet<ApiAiRecommendation[]>('/ai/recommendations')
    .then(res => {
      cache = res.data.map(fromApi);
      // 다음에 페이지를 다시 열면 새로 받는다
      setTimeout(() => { cache = null; pending = null; }, 60_000);
      return cache;
    })
    .catch(err => {
      pending = null;
      throw err;
    });
  return pending;
}

export function useAiRecommendations(): AiRecommendations {
  const [all, setAll] = useState<AiRecommendation[] | null>(cache);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    load()
      .then(recs => { if (alive) setAll(recs); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  return {
    status: all ? 'ready' : error ? 'error' : 'loading',
    current: (all ?? []).filter(r => !r.result),
    past: (all ?? []).filter(r => r.result),
  };
}

/** 검증이 끝난 추천 중 적중한 비율(0~1). 결과가 없으면 null */
export function hitRateOf(past: AiRecommendation[], model: AiModel, period: PeriodType | 'ALL' = 'ALL'): number | null {
  const done = past.filter(r => r.result && r.aiModel === model && (period === 'ALL' || r.periodType === period));
  if (done.length === 0) return null;
  return done.filter(r => r.result!.isHit).length / done.length;
}

/** 추천 방향 기준 수익률. 매도 추천은 떨어진 만큼을 수익으로 본다 */
export function directionalReturn(r: AiRecommendation): number {
  if (!r.result) return 0;
  return r.opinion === 'BUY' ? r.result.returnRate : -r.result.returnRate;
}

export interface AiStats {
  total: number;
  hits: number;
  avgReturn: number;
  best: AiRecommendation | null;
  // 오래된 것부터 최근 순
  recent: AiRecommendation[];
}

/** 검증이 끝난 추천으로 AI 성적을 낸다 */
export function statsOf(past: AiRecommendation[], model: AiModel): AiStats {
  const done = past
    .filter(r => r.result && r.aiModel === model)
    .sort((a, b) => a.result!.evaluatedAt.localeCompare(b.result!.evaluatedAt));
  const hits = done.filter(r => r.result!.isHit);
  const best = hits.reduce<AiRecommendation | null>(
    (acc, r) => (!acc || directionalReturn(r) > directionalReturn(acc) ? r : acc), null,
  );
  return {
    total: done.length,
    hits: hits.length,
    avgReturn: done.length ? done.reduce((sum, r) => sum + directionalReturn(r), 0) / done.length : 0,
    best,
    recent: done.slice(-10),
  };
}

function weekStart(iso: string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // 그 주 월요일
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 주별 누적 적중률 추이 (0~1). 검증일이 속한 주(월요일 기준)까지 쌓인 결과로 계산한다 */
export function hitRateTrend(past: AiRecommendation[]): { week: string; rates: Partial<Record<AiModel, number>> }[] {
  const weeks = [...new Set(past.filter(r => r.result).map(r => weekStart(r.result!.evaluatedAt)))].sort();
  const models = [...new Set(past.map(r => r.aiModel))];
  return weeks.map(week => {
    const rates: Partial<Record<AiModel, number>> = {};
    for (const model of models) {
      const done = past.filter(r => r.result && r.aiModel === model && weekStart(r.result.evaluatedAt) <= week);
      if (done.length) rates[model] = done.filter(r => r.result!.isHit).length / done.length;
    }
    return { week, rates };
  });
}

export interface AiConsensusPick {
  stockCode: string;
  stockName: string;
  // 이 종목을 고른 AI (중복 없이)
  models: AiModel[];
  buy: number;
  sell: number;
  verdict: 'BUY' | 'SELL' | 'SPLIT';
}

/** 2개 이상의 AI가 고른 종목. 고른 AI가 많은 순, 같으면 의견이 모인 것부터 */
export function consensusPicks(current: AiRecommendation[], limit = 3): AiConsensusPick[] {
  const byStock = new Map<string, AiRecommendation[]>();
  for (const r of current) byStock.set(r.stockCode, [...(byStock.get(r.stockCode) ?? []), r]);
  return [...byStock.values()]
    .map(recs => {
      const buy = recs.filter(r => r.opinion === 'BUY').length;
      const sell = recs.length - buy;
      return {
        stockCode: recs[0].stockCode,
        stockName: recs[0].stockName,
        models: [...new Set(recs.map(r => r.aiModel))],
        buy,
        sell,
        verdict: sell === 0 ? 'BUY' : buy === 0 ? 'SELL' : 'SPLIT',
      } as AiConsensusPick;
    })
    .filter(p => p.models.length >= 2)
    .sort((a, b) => b.models.length - a.models.length || Number(a.verdict === 'SPLIT') - Number(b.verdict === 'SPLIT'))
    .slice(0, limit);
}

/** AI마다 확신도가 가장 높은 추천 하나 (공통 종목이 없을 때 대신 보여준다) */
export function topPickPerModel(current: AiRecommendation[]): AiRecommendation[] {
  const best = new Map<AiModel, AiRecommendation>();
  for (const r of current) {
    const prev = best.get(r.aiModel);
    if (!prev || (r.confidence ?? 0) > (prev.confidence ?? 0)) best.set(r.aiModel, r);
  }
  return [...best.values()];
}

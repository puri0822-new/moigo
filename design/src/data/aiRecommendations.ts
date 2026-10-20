// AI 분석 페이지용 임시 더미 데이터. 백엔드 API(ai_recommendations 테이블)가 붙으면 교체한다.
// 뉴스 제목·언론사는 화면 확인용으로 지어낸 것이라 링크(url)는 비워 둔다.

import type { AiModel } from '../lib/aiModels';

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
  evidence: AiEvidence[];
  priceAtRecommendation: number;
  recommendedAt: string;
  // 이 날짜에 그때 가격과 비교해 적중 여부를 검증한다 (주간은 1주 뒤, 월간은 1달 뒤)
  evaluateAt: string;
  result?: AiRecommendationResult;
}

export const AI_RECOMMENDATIONS: AiRecommendation[] = [
  {
    id: 1, aiModel: 'GPT', periodType: 'WEEKLY', stockCode: '005930', stockName: '삼성전자', sector: '반도체/전자', opinion: 'BUY',
    reason: 'HBM 공급 확대 기사가 이어지며 실적 기대감이 커지고 있음. 단기적으로 외국인 매수세 유입이 예상됨',
    evidence: [
      { title: '삼성전자, 차세대 HBM 공급 물량 확대 합의', source: '경제신문', publishedAt: '2026-10-11', insight: '고부가 메모리 매출 비중이 늘어 다음 분기 실적 개선 요인' },
      { title: '외국인, 반도체 대형주 5거래일 연속 순매수', source: '증권일보', publishedAt: '2026-10-10', insight: '수급이 개선되는 흐름이라 단기 상승 가능성을 높게 봄' },
    ],
    priceAtRecommendation: 217000, recommendedAt: '2026-10-12', evaluateAt: '2026-10-19',
  },
  {
    id: 2, aiModel: 'GPT', periodType: 'WEEKLY', stockCode: '000660', stockName: 'SK하이닉스', sector: '반도체/전자', opinion: 'BUY',
    reason: '메모리 가격 상승 전망 보도가 잇따르고 있어 단기 주가에 긍정적임',
    evidence: [
      { title: '4분기 D램 고정거래가격 상승 전망', source: '테크데일리', publishedAt: '2026-10-09', insight: '판가 상승은 메모리 업체 이익에 바로 반영됨' },
      { title: 'AI 서버용 메모리 주문 증가세 지속', source: '경제신문', publishedAt: '2026-10-11', insight: '주력 제품 수요가 견조하다는 신호' },
    ],
    priceAtRecommendation: 1265000, recommendedAt: '2026-10-12', evaluateAt: '2026-10-19',
  },
  {
    id: 3, aiModel: 'GPT', periodType: 'WEEKLY', stockCode: '035420', stockName: 'NAVER', sector: 'IT서비스', opinion: 'SELL',
    reason: '광고 매출 둔화 우려 기사가 늘고 있어 단기 약세가 예상됨',
    evidence: [
      { title: '3분기 온라인 광고 시장 성장률 둔화', source: '미디어경제', publishedAt: '2026-10-08', insight: '광고는 주요 매출원이라 실적 눈높이가 낮아질 수 있음' },
      { title: '플랫폼 규제 법안 국회 논의 재개', source: '정책신문', publishedAt: '2026-10-10', insight: '규제 불확실성은 투자 심리에 부정적' },
    ],
    priceAtRecommendation: 182000, recommendedAt: '2026-10-12', evaluateAt: '2026-10-19',
  },
  {
    id: 4, aiModel: 'GPT', periodType: 'MONTHLY', stockCode: '005380', stockName: '현대차', sector: '자동차', opinion: 'BUY',
    reason: '신차 판매 호조와 우호적인 환율이 겹쳐 한 달간 실적 기대감이 이어질 것으로 봄',
    evidence: [
      { title: '9월 해외 판매 전년 대비 증가', source: '산업일보', publishedAt: '2026-09-30', insight: '주력 시장 판매가 늘어 매출 성장 근거가 됨' },
      { title: '원·달러 환율 고점 유지', source: '경제신문', publishedAt: '2026-09-29', insight: '수출 비중이 높아 환율 효과로 이익이 늘어남' },
    ],
    priceAtRecommendation: 238000, recommendedAt: '2026-10-01', evaluateAt: '2026-11-01',
  },
  {
    id: 5, aiModel: 'GPT', periodType: 'MONTHLY', stockCode: '005930', stockName: '삼성전자', sector: '반도체/전자', opinion: 'BUY',
    reason: '반도체 업황이 회복 흐름에 들어섰다는 보도가 많아 중기적으로 상승 여력이 있음',
    evidence: [
      { title: '반도체 수출 3개월 연속 증가', source: '정책신문', publishedAt: '2026-09-30', insight: '업황 회복이 수치로 확인되는 단계' },
    ],
    priceAtRecommendation: 209000, recommendedAt: '2026-10-01', evaluateAt: '2026-11-01',
  },
  {
    id: 6, aiModel: 'GEMINI', periodType: 'WEEKLY', stockCode: '000660', stockName: 'SK하이닉스', sector: '반도체/전자', opinion: 'BUY',
    reason: 'AI 서버 수요 관련 긍정 뉴스가 많고 증권가 목표주가 상향이 이어지고 있음',
    evidence: [
      { title: '글로벌 빅테크, AI 데이터센터 투자 확대 발표', source: '테크데일리', publishedAt: '2026-10-10', insight: 'AI 서버용 메모리 수요 증가로 이어짐' },
      { title: '증권사 3곳, SK하이닉스 목표주가 상향', source: '증권일보', publishedAt: '2026-10-11', insight: '시장 기대치가 올라가는 흐름' },
    ],
    priceAtRecommendation: 1265000, recommendedAt: '2026-10-12', evaluateAt: '2026-10-19',
  },
  {
    id: 7, aiModel: 'GEMINI', periodType: 'WEEKLY', stockCode: '051910', stockName: 'LG화학', sector: '배터리/화학', opinion: 'SELL',
    reason: '배터리 소재 수요 둔화 보도와 원가 부담이 겹쳐 단기 하락이 예상됨',
    evidence: [
      { title: '전기차 판매 증가세 둔화, 소재 재고 증가', source: '산업일보', publishedAt: '2026-10-09', insight: '수요 둔화로 소재 판가가 낮아질 가능성' },
      { title: '국제 유가 상승에 석유화학 원가 부담', source: '경제신문', publishedAt: '2026-10-10', insight: '화학 부문 마진이 줄어들 수 있음' },
    ],
    priceAtRecommendation: 312000, recommendedAt: '2026-10-12', evaluateAt: '2026-10-19',
  },
  {
    id: 8, aiModel: 'GEMINI', periodType: 'MONTHLY', stockCode: '035720', stockName: '카카오', sector: 'IT서비스', opinion: 'BUY',
    reason: '신규 서비스 출시 기대감이 커지고 있어 한 달 안에 반등할 여지가 있음',
    evidence: [
      { title: '카카오, AI 기반 신규 서비스 이달 출시 예정', source: '테크데일리', publishedAt: '2026-09-28', insight: '새 매출원에 대한 기대가 주가에 반영될 수 있음' },
    ],
    priceAtRecommendation: 41000, recommendedAt: '2026-10-01', evaluateAt: '2026-11-01',
  },
  {
    id: 9, aiModel: 'GEMINI', periodType: 'MONTHLY', stockCode: '068270', stockName: '셀트리온', sector: '제약바이오', opinion: 'BUY',
    reason: '해외 허가 관련 긍정 뉴스가 나와 신제품 매출 기대가 커지고 있음',
    evidence: [
      { title: '셀트리온 바이오시밀러, 해외 판매 허가 획득', source: '바이오신문', publishedAt: '2026-09-29', insight: '새 시장 진출로 매출 확대 근거가 됨' },
      { title: '바이오 업종 투자 심리 개선', source: '증권일보', publishedAt: '2026-09-30', insight: '업종 전반의 수급이 우호적' },
    ],
    priceAtRecommendation: 178000, recommendedAt: '2026-10-01', evaluateAt: '2026-11-01',
  },
];

// 검증이 끝난 지난 추천. BUY는 오르면, SELL은 떨어지면 적중
export const AI_PAST_RECOMMENDATIONS: AiRecommendation[] = [
  {
    id: 101, aiModel: 'GPT', periodType: 'WEEKLY', stockCode: '000660', stockName: 'SK하이닉스', sector: '반도체/전자', opinion: 'BUY',
    reason: '메모리 업황 개선 기대가 커지고 외국인 매수세가 이어지고 있음',
    evidence: [{ title: 'D램 현물가격 2주 연속 상승', source: '테크데일리', publishedAt: '2026-10-03', insight: '판가 상승이 이익 개선으로 이어질 것' }],
    priceAtRecommendation: 1180000, recommendedAt: '2026-10-05', evaluateAt: '2026-10-12',
    result: { priceAtEvaluation: 1265000, returnRate: 0.072, isHit: true, evaluatedAt: '2026-10-12' },
  },
  {
    id: 102, aiModel: 'GPT', periodType: 'WEEKLY', stockCode: '035720', stockName: '카카오', sector: 'IT서비스', opinion: 'BUY',
    reason: '신규 서비스 기대감으로 단기 반등이 예상됨',
    evidence: [{ title: '카카오, 신규 AI 서비스 공개 예고', source: '테크데일리', publishedAt: '2026-10-02', insight: '새 매출원 기대감' }],
    priceAtRecommendation: 42500, recommendedAt: '2026-10-05', evaluateAt: '2026-10-12',
    result: {
      priceAtEvaluation: 41000, returnRate: -0.0353, isHit: false, evaluatedAt: '2026-10-12',
      failureReason: '서비스 공개가 다음 달로 미뤄졌다는 보도가 나오면서 기대감이 꺾였음. 출시 일정이 확정되지 않은 기대감만으로 추천한 것이 실패 원인',
    },
  },
  {
    id: 103, aiModel: 'GPT', periodType: 'WEEKLY', stockCode: '051910', stockName: 'LG화학', sector: '배터리/화학', opinion: 'SELL',
    reason: '전기차 수요 둔화로 배터리 소재 실적 우려가 커지고 있음',
    evidence: [{ title: '전기차 재고 증가, 소재 주문 감소', source: '산업일보', publishedAt: '2026-10-02', insight: '소재 판가 하락 가능성' }],
    priceAtRecommendation: 335000, recommendedAt: '2026-10-05', evaluateAt: '2026-10-12',
    result: { priceAtEvaluation: 312000, returnRate: -0.0687, isHit: true, evaluatedAt: '2026-10-12' },
  },
  {
    id: 104, aiModel: 'GPT', periodType: 'MONTHLY', stockCode: '068270', stockName: '셀트리온', sector: '제약바이오', opinion: 'SELL',
    reason: '임상 일정 지연 우려로 한 달간 약세가 예상됨',
    evidence: [{ title: '바이오 업종 임상 일정 지연 잇따라', source: '바이오신문', publishedAt: '2026-08-30', insight: '신약 기대감이 줄어들 수 있음' }],
    priceAtRecommendation: 165000, recommendedAt: '2026-09-01', evaluateAt: '2026-10-01',
    result: {
      priceAtEvaluation: 178000, returnRate: 0.0788, isHit: false, evaluatedAt: '2026-10-01',
      failureReason: '추천 직후 해외 판매 허가 소식이 나오며 주가가 크게 올랐음. 허가 심사 일정을 근거 뉴스에서 놓친 것이 실패 원인',
    },
  },
  {
    id: 105, aiModel: 'GPT', periodType: 'MONTHLY', stockCode: '005380', stockName: '현대차', sector: '자동차', opinion: 'BUY',
    reason: '환율 효과와 판매 호조로 실적 기대감이 이어질 것',
    evidence: [{ title: '8월 자동차 수출 역대 최대', source: '산업일보', publishedAt: '2026-08-31', insight: '수출 증가가 실적으로 이어짐' }],
    priceAtRecommendation: 226000, recommendedAt: '2026-09-01', evaluateAt: '2026-10-01',
    result: { priceAtEvaluation: 238000, returnRate: 0.0531, isHit: true, evaluatedAt: '2026-10-01' },
  },
  {
    id: 201, aiModel: 'GEMINI', periodType: 'WEEKLY', stockCode: '005930', stockName: '삼성전자', sector: '반도체/전자', opinion: 'BUY',
    reason: 'HBM 관련 수주 기대감이 커지고 있음',
    evidence: [{ title: '삼성전자, HBM 품질 테스트 통과 임박', source: '경제신문', publishedAt: '2026-10-03', insight: '수주 가능성이 주가에 반영될 것' }],
    priceAtRecommendation: 208000, recommendedAt: '2026-10-05', evaluateAt: '2026-10-12',
    result: { priceAtEvaluation: 217000, returnRate: 0.0433, isHit: true, evaluatedAt: '2026-10-12' },
  },
  {
    id: 202, aiModel: 'GEMINI', periodType: 'WEEKLY', stockCode: '035420', stockName: 'NAVER', sector: 'IT서비스', opinion: 'BUY',
    reason: '커머스 거래액 증가로 실적 개선이 기대됨',
    evidence: [{ title: '온라인 쇼핑 거래액 전년 대비 증가', source: '미디어경제', publishedAt: '2026-10-02', insight: '커머스 매출 성장 근거' }],
    priceAtRecommendation: 189000, recommendedAt: '2026-10-05', evaluateAt: '2026-10-12',
    result: {
      priceAtEvaluation: 182000, returnRate: -0.037, isHit: false, evaluatedAt: '2026-10-12',
      failureReason: '커머스 호조보다 광고 시장 둔화 보도가 더 크게 반영됐음. 매출 비중이 큰 광고 부문 뉴스를 가볍게 본 것이 실패 원인',
    },
  },
  {
    id: 203, aiModel: 'GEMINI', periodType: 'MONTHLY', stockCode: '000660', stockName: 'SK하이닉스', sector: '반도체/전자', opinion: 'BUY',
    reason: 'AI 서버 투자 확대로 고부가 메모리 수요가 늘 것',
    evidence: [{ title: '빅테크 3분기 설비투자 확대', source: '테크데일리', publishedAt: '2026-08-29', insight: 'AI 메모리 수요 증가' }],
    priceAtRecommendation: 1090000, recommendedAt: '2026-09-01', evaluateAt: '2026-10-01',
    result: { priceAtEvaluation: 1180000, returnRate: 0.0826, isHit: true, evaluatedAt: '2026-10-01' },
  },
  {
    id: 204, aiModel: 'GEMINI', periodType: 'MONTHLY', stockCode: '005380', stockName: '현대차', sector: '자동차', opinion: 'SELL',
    reason: '관세 부담 우려로 한 달간 약세가 예상됨',
    evidence: [{ title: '수입차 관세 인상 논의', source: '정책신문', publishedAt: '2026-08-28', insight: '수출 수익성 악화 우려' }],
    priceAtRecommendation: 221000, recommendedAt: '2026-09-01', evaluateAt: '2026-10-01',
    result: {
      priceAtEvaluation: 238000, returnRate: 0.0769, isHit: false, evaluatedAt: '2026-10-01',
      failureReason: '관세 논의가 유예되고 환율 효과가 더 크게 작용했음. 정책이 확정되기 전의 논의 단계 뉴스에 무게를 많이 둔 것이 실패 원인',
    },
  },
];

/** 검증이 끝난 추천 중 적중한 비율(0~1). 결과가 없으면 null */
export function hitRateOf(model: AiModel, period: PeriodType | 'ALL' = 'ALL'): number | null {
  const done = AI_PAST_RECOMMENDATIONS.filter(
    r => r.result && r.aiModel === model && (period === 'ALL' || r.periodType === period),
  );
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
export function statsOf(model: AiModel): AiStats {
  const done = AI_PAST_RECOMMENDATIONS
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

// 주별 누적 적중률 추이 (0~1). 더미 값이라 성적표 건수와 맞지 않는다. 실제로는 검증 결과를 주 단위로 누적해 계산한다
export const AI_HIT_RATE_TREND: { week: string; rates: Partial<Record<AiModel, number>> }[] = [
  { week: '2026-08-31', rates: { GPT: 0.5, GEMINI: 0.67 } },
  { week: '2026-09-07', rates: { GPT: 0.57, GEMINI: 0.6 } },
  { week: '2026-09-14', rates: { GPT: 0.55, GEMINI: 0.58 } },
  { week: '2026-09-21', rates: { GPT: 0.62, GEMINI: 0.54 } },
  { week: '2026-09-28', rates: { GPT: 0.58, GEMINI: 0.55 } },
  { week: '2026-10-05', rates: { GPT: 0.61, GEMINI: 0.52 } },
  { week: '2026-10-12', rates: { GPT: 0.6, GEMINI: 0.5 } },
];

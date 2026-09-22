import type { Stock, Holding, AIRec, OrderbookEntry } from '../types';

export const stocks: Stock[] = [
  {
    rank: 1, name: '삼성전자', code: '005930', price: '78,200원', volume: '12.3M', changePct: 2.1,
    aiReason: '어제 발표된 3분기 실적에서 반도체 부문 영업이익이 예상치를 상회했다는 뉴스가 확산되며 매수세가 몰렸습니다.',
    aiComment: '단기 수급이 강하지만 이미 상당폭 상승했습니다. 추가 매수는 실적 발표 이후 반응을 지켜보는 것을 참고하세요.',
    similar: ['SK하이닉스', '삼성전기', 'DB하이텍'],
    news: [
      { title: '삼성전자, 3분기 반도체 영업이익 시장 예상 상회', source: '경제신문', time: '2시간 전' },
      { title: '외국인 순매수 상위 1위 기록', source: '증권속보', time: '5시간 전' },
      { title: '파운드리 신규 수주 소식 전해져', source: 'IT데일리', time: '1일 전' },
    ],
  },
  {
    rank: 2, name: '카카오', code: '035720', price: '41,800원', volume: '9.8M', changePct: -0.7,
    aiReason: '플랫폼 규제 강화 우려가 담긴 정부 발표 뉴스가 나오며 투자심리가 위축됐습니다.',
    aiComment: '규제 관련 불확실성이 해소될 때까지 변동성이 클 수 있습니다.',
    similar: ['네이버', '카카오뱅크', '카카오페이'],
    news: [
      { title: '공정위, 플랫폼 규제안 초안 공개', source: '정책브리핑', time: '3시간 전' },
      { title: '카카오톡 신규 광고 정책 발표', source: '테크뉴스', time: '8시간 전' },
    ],
  },
  {
    rank: 3, name: 'SK하이닉스', code: '000660', price: '215,500원', volume: '8.1M', changePct: 4.0,
    aiReason: 'HBM 메모리 대규모 공급 계약 체결 소식이 전해지며 강한 상승세를 보였습니다.',
    aiComment: '호재가 명확한 편이나 단기 급등에 따른 되돌림 가능성도 함께 고려하세요.',
    similar: ['삼성전자', '한미반도체', '이수페타시스'],
    news: [
      { title: 'SK하이닉스, 글로벌 AI기업과 HBM 대규모 공급계약', source: '경제신문', time: '1시간 전' },
      { title: '메모리 반도체 업황 개선 전망 보고서 발표', source: '증권리서치', time: '6시간 전' },
    ],
  },
  {
    rank: 4, name: 'NAVER', code: '035420', price: '188,900원', volume: '6.5M', changePct: -1.2,
    aiReason: '경쟁사 AI 검색 서비스 출시 뉴스로 점유율 우려가 반영됐습니다.',
    aiComment: '중장기 AI 투자 성과가 확인되기 전까지 관망하는 투자자가 많습니다.',
    similar: ['카카오', '크래프톤', '더존비즈온'],
    news: [
      { title: '경쟁 플랫폼, AI 검색 정식 출시', source: 'IT데일리', time: '4시간 전' },
      { title: '네이버, 자체 AI 모델 업데이트 예고', source: '테크뉴스', time: '9시간 전' },
    ],
  },
  {
    rank: 5, name: 'LG에너지솔루션', code: '373220', price: '412,000원', volume: '5.2M', changePct: 1.5,
    aiReason: '북미 완성차업체와의 신규 배터리 공급계약 소식이 긍정적으로 작용했습니다.',
    aiComment: '전기차 수요 둔화 우려가 상존하니 업종 전반 뉴스를 함께 살펴보세요.',
    similar: ['삼성SDI', '포스코퓨처엠', '에코프로비엠'],
    news: [
      { title: '북미 완성차업체와 배터리 장기 공급계약 체결', source: '경제신문', time: '3시간 전' },
    ],
  },
  {
    rank: 6, name: '현대차', code: '005380', price: '256,000원', volume: '4.4M', changePct: 0.8,
    aiReason: '신형 전기차 사전계약 호조 소식이 전해졌습니다.',
    aiComment: '완만한 상승 흐름으로, 특별한 리스크 신호는 관측되지 않습니다.',
    similar: ['기아', '현대모비스', '한국타이어'],
    news: [
      { title: '신형 전기차 사전계약 목표치 초과 달성', source: '경제신문', time: '5시간 전' },
    ],
  },
  {
    rank: 7, name: '포스코퓨처엠', code: '003670', price: '298,500원', volume: '3.9M', changePct: -2.4,
    aiReason: '2차전지 소재 가격 하락 전망 리포트가 발표되며 매도세가 이어졌습니다.',
    aiComment: '원자재 가격 추이에 따라 단기 변동성이 커질 수 있어 주의가 필요합니다.',
    similar: ['에코프로비엠', 'LG에너지솔루션', '포스코홀딩스'],
    news: [
      { title: '양극재 가격 하락 전망 리포트 발표', source: '증권리서치', time: '2시간 전' },
    ],
  },
  {
    rank: 8, name: '셀트리온', code: '068270', price: '176,300원', volume: '3.1M', changePct: 1.1,
    aiReason: '유럽 시장 신규 바이오시밀러 판매 허가 소식이 긍정적으로 작용했습니다.',
    aiComment: '해외 인허가 이슈가 지속 호재로 작용 중입니다.',
    similar: ['삼성바이오로직스', '유한양행', '한미약품'],
    news: [
      { title: '유럽서 신규 바이오시밀러 판매 허가 획득', source: '제약전문지', time: '7시간 전' },
    ],
  },
];

export const holdings: Holding[] = [
  { name: '삼성전자', qty: '10주', changePct: 1.8 },
  { name: '카카오', qty: '5주', changePct: -0.9 },
  { name: 'SK하이닉스', qty: '3주', changePct: 3.2 },
  { name: 'NAVER', qty: '2주', changePct: -0.4 },
];

export const aiRecs: AIRec[] = [
  { bot: 'AI-분석봇', stockName: 'SK하이닉스', reason: '실적 서프라이즈와 HBM 대형 계약 소식이 겹쳐 단기 상승 모멘텀이 강합니다.' },
  { bot: 'AI-뉴스봇', stockName: '카카오', reason: '플랫폼 규제 뉴스로 하락했으나 과거 유사 사례에서 규제 확정 전까지 변동성이 지속됐습니다.' },
  { bot: 'AI-트렌드봇', stockName: '삼성전자', reason: '반도체 업황 개선 기대감이 뉴스와 리서치 리포트에서 동시에 언급되고 있습니다.' },
  { bot: 'AI-리스크봇', stockName: '포스코퓨처엠', reason: '소재 가격 하락 전망으로 관련 섹터 전반의 하락 압력이 감지됩니다.' },
];

export const orderbook: OrderbookEntry[] = [
  { price: '78,400원', qty: '1,240', dir: 'down' },
  { price: '78,300원', qty: '3,110', dir: 'down' },
  { price: '78,200원', qty: '5,032', dir: 'mid' },
  { price: '78,100원', qty: '2,880', dir: 'up' },
  { price: '78,000원', qty: '1,760', dir: 'up' },
];

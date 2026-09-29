import type { Stock, Holding, AIRec, OrderbookEntry, MarketIndex } from '../types';

export const marketIndices: MarketIndex[] = [
  { name: '코스피', value: '2,634.87', changePct: 0.82, changePoint: '+21.45',
    spark: [2580, 2591, 2574, 2603, 2598, 2611, 2605, 2619, 2613, 2628, 2622, 2635] },
  { name: '코스닥', value: '842.13', changePct: -0.35, changePoint: '-2.96',
    spark: [848, 852, 845, 850, 847, 843, 849, 844, 846, 841, 845, 842] },
];

export const stocks: Stock[] = [
  {
    rank: 1, name: '삼성전자', code: '005930', sector: '반도체', price: '78,200원', volume: '12.3M', changePct: 2.1,
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
    rank: 2, name: '카카오', code: '035720', sector: '플랫폼', price: '41,800원', volume: '9.8M', changePct: -0.7,
    aiReason: '플랫폼 규제 강화 우려가 담긴 정부 발표 뉴스가 나오며 투자심리가 위축됐습니다.',
    aiComment: '규제 관련 불확실성이 해소될 때까지 변동성이 클 수 있습니다.',
    similar: ['네이버', '카카오뱅크', '카카오페이'],
    news: [
      { title: '공정위, 플랫폼 규제안 초안 공개', source: '정책브리핑', time: '3시간 전' },
      { title: '카카오톡 신규 광고 정책 발표', source: '테크뉴스', time: '8시간 전' },
    ],
  },
  {
    rank: 3, name: 'SK하이닉스', code: '000660', sector: '반도체', price: '215,500원', volume: '8.1M', changePct: 4.0,
    aiReason: 'HBM 메모리 대규모 공급 계약 체결 소식이 전해지며 강한 상승세를 보였습니다.',
    aiComment: '호재가 명확한 편이나 단기 급등에 따른 되돌림 가능성도 함께 고려하세요.',
    similar: ['삼성전자', '한미반도체', '이수페타시스'],
    news: [
      { title: 'SK하이닉스, 글로벌 AI기업과 HBM 대규모 공급계약', source: '경제신문', time: '1시간 전' },
      { title: '메모리 반도체 업황 개선 전망 보고서 발표', source: '증권리서치', time: '6시간 전' },
    ],
  },
  {
    rank: 4, name: 'NAVER', code: '035420', sector: '플랫폼', price: '188,900원', volume: '6.5M', changePct: -1.2,
    aiReason: '경쟁사 AI 검색 서비스 출시 뉴스로 점유율 우려가 반영됐습니다.',
    aiComment: '중장기 AI 투자 성과가 확인되기 전까지 관망하는 투자자가 많습니다.',
    similar: ['카카오', '크래프톤', '더존비즈온'],
    news: [
      { title: '경쟁 플랫폼, AI 검색 정식 출시', source: 'IT데일리', time: '4시간 전' },
      { title: '네이버, 자체 AI 모델 업데이트 예고', source: '테크뉴스', time: '9시간 전' },
    ],
  },
  {
    rank: 5, name: 'LG에너지솔루션', code: '373220', sector: '2차전지', price: '412,000원', volume: '5.2M', changePct: 1.5,
    aiReason: '북미 완성차업체와의 신규 배터리 공급계약 소식이 긍정적으로 작용했습니다.',
    aiComment: '전기차 수요 둔화 우려가 상존하니 업종 전반 뉴스를 함께 살펴보세요.',
    similar: ['삼성SDI', '포스코퓨처엠', '에코프로비엠'],
    news: [
      { title: '북미 완성차업체와 배터리 장기 공급계약 체결', source: '경제신문', time: '3시간 전' },
    ],
  },
  {
    rank: 6, name: '현대차', code: '005380', sector: '자동차', price: '256,000원', volume: '4.4M', changePct: 0.8,
    aiReason: '신형 전기차 사전계약 호조 소식이 전해졌습니다.',
    aiComment: '완만한 상승 흐름으로, 특별한 리스크 신호는 관측되지 않습니다.',
    similar: ['기아', '현대모비스', '한국타이어'],
    news: [
      { title: '신형 전기차 사전계약 목표치 초과 달성', source: '경제신문', time: '5시간 전' },
    ],
  },
  {
    rank: 7, name: '포스코퓨처엠', code: '003670', sector: '2차전지', price: '298,500원', volume: '3.9M', changePct: -2.4,
    aiReason: '2차전지 소재 가격 하락 전망 리포트가 발표되며 매도세가 이어졌습니다.',
    aiComment: '원자재 가격 추이에 따라 단기 변동성이 커질 수 있어 주의가 필요합니다.',
    similar: ['에코프로비엠', 'LG에너지솔루션', '포스코홀딩스'],
    news: [
      { title: '양극재 가격 하락 전망 리포트 발표', source: '증권리서치', time: '2시간 전' },
    ],
  },
  {
    rank: 8, name: '셀트리온', code: '068270', sector: '바이오', price: '176,300원', volume: '3.1M', changePct: 1.1,
    aiReason: '유럽 시장 신규 바이오시밀러 판매 허가 소식이 긍정적으로 작용했습니다.',
    aiComment: '해외 인허가 이슈가 지속 호재로 작용 중입니다.',
    similar: ['삼성바이오로직스', '유한양행', '한미약품'],
    news: [
      { title: '유럽서 신규 바이오시밀러 판매 허가 획득', source: '제약전문지', time: '7시간 전' },
    ],
  },
  {
    rank: 9, name: '삼성바이오로직스', code: '207940', sector: '바이오', price: '897,000원', volume: '2.8M', changePct: 0.6,
    aiReason: '글로벌 CMO 수주 증가 기대감이 반영되며 기관 매수세가 유입됐습니다.',
    aiComment: '바이오 섹터 내 안정적인 실적 성장이 기대됩니다.',
    similar: ['셀트리온', '한미약품', '유한양행'],
    news: [
      { title: '삼성바이오, 글로벌 제약사 신규 CMO 계약 체결', source: '제약전문지', time: '3시간 전' },
    ],
  },
  {
    rank: 10, name: '기아', code: '000270', sector: '자동차', price: '112,300원', volume: '2.6M', changePct: 1.3,
    aiReason: '북미 신차 판매 호조와 친환경차 라인업 확대 소식이 주가를 끌어올렸습니다.',
    aiComment: '현대차 그룹 전반의 실적 개선 흐름이 긍정적입니다.',
    similar: ['현대차', '현대모비스', '한국타이어'],
    news: [
      { title: '기아, 북미 전기차 판매 전년 대비 34% 증가', source: '자동차전문지', time: '4시간 전' },
    ],
  },
  {
    rank: 11, name: '크래프톤', code: '259960', sector: '게임', price: '342,000원', volume: '2.4M', changePct: -0.9,
    aiReason: '신규 게임 출시 일정 지연 소식에 실망 매물이 출회됐습니다.',
    aiComment: '신작 출시 시기가 구체화될 때까지 관망세가 이어질 수 있습니다.',
    similar: ['넥슨', '엔씨소프트', '넷마블'],
    news: [
      { title: '크래프톤 신작 출시 일정 2분기로 연기', source: '게임뉴스', time: '5시간 전' },
    ],
  },
  {
    rank: 12, name: '한미약품', code: '128940', sector: '제약', price: '387,500원', volume: '2.2M', changePct: 2.8,
    aiReason: '비만 치료제 임상 3상 긍정적 중간 결과 발표로 급등했습니다.',
    aiComment: '임상 성공 시 글로벌 시장 진출 가능성이 높아 주목할 만합니다.',
    similar: ['유한양행', '셀트리온', '동아에스티'],
    news: [
      { title: '한미약품 비만치료제 임상 3상 중간결과 긍정적', source: '제약전문지', time: '1시간 전' },
    ],
  },
  {
    rank: 13, name: '카카오뱅크', code: '323410', sector: '금융', price: '23,450원', volume: '2.0M', changePct: -1.5,
    aiReason: '인터넷은행 규제 강화 우려와 함께 금리 인하 수혜 기대감이 약화됐습니다.',
    aiComment: '금리 방향성이 확인될 때까지 단기 변동성에 주의하세요.',
    similar: ['카카오', '카카오페이', '토스뱅크'],
    news: [
      { title: '인터넷전문은행 건전성 규제 강화 방안 발표', source: '금융뉴스', time: '6시간 전' },
    ],
  },
  {
    rank: 14, name: '삼성SDI', code: '006400', sector: '2차전지', price: '378,000원', volume: '1.9M', changePct: 0.5,
    aiReason: '전고체 배터리 상용화 로드맵 발표로 장기 성장 기대감이 유입됐습니다.',
    aiComment: '배터리 기술 선도 기업으로 장기 투자 관점에서 긍정적입니다.',
    similar: ['LG에너지솔루션', '포스코퓨처엠', 'SK온'],
    news: [
      { title: '삼성SDI, 2027년 전고체 배터리 양산 계획 발표', source: '테크뉴스', time: '8시간 전' },
    ],
  },
  {
    rank: 15, name: '카카오페이', code: '377300', sector: '핀테크', price: '31,200원', volume: '1.8M', changePct: -2.1,
    aiReason: '핀테크 경쟁 심화와 수익성 개선 지연 우려로 매도세가 이어졌습니다.',
    aiComment: '수익 모델 다각화 성과가 확인되기 전까지 보수적 접근이 필요합니다.',
    similar: ['카카오뱅크', '카카오', '토스'],
    news: [
      { title: '카카오페이, 2분기 영업손실 지속', source: '금융뉴스', time: '7시간 전' },
    ],
  },
  {
    rank: 16, name: '현대모비스', code: '012330', sector: '자동차부품', price: '241,500원', volume: '1.7M', changePct: 0.9,
    aiReason: '전기차 부품 수주 확대와 자율주행 부품 매출 증가 기대감이 반영됐습니다.',
    aiComment: '모빌리티 전환 수혜주로 안정적인 성장이 기대됩니다.',
    similar: ['현대차', '기아', '만도'],
    news: [
      { title: '현대모비스, 자율주행 센서 모듈 글로벌 공급 확대', source: '자동차전문지', time: '9시간 전' },
    ],
  },
  {
    rank: 17, name: '에코프로비엠', code: '247540', sector: '2차전지', price: '156,700원', volume: '1.6M', changePct: -3.2,
    aiReason: '양극재 판가 하락과 고객사 재고 조정 이슈가 동시에 부각됐습니다.',
    aiComment: '원자재 가격 반등 시그널이 나올 때까지 주의가 필요합니다.',
    similar: ['포스코퓨처엠', '삼성SDI', 'LG에너지솔루션'],
    news: [
      { title: '에코프로비엠, 주요 고객사 발주 축소 영향', source: '증권리서치', time: '3시간 전' },
    ],
  },
  {
    rank: 18, name: '유한양행', code: '000100', sector: '제약', price: '89,400원', volume: '1.5M', changePct: 1.7,
    aiReason: '레이저티닙 미국 FDA 병용요법 추가 허가로 매수세가 집중됐습니다.',
    aiComment: '글로벌 항암제 시장 진출 성과가 가시화되고 있습니다.',
    similar: ['한미약품', '셀트리온', '동아에스티'],
    news: [
      { title: '유한양행 레이저티닙 미국 병용요법 FDA 허가 획득', source: '제약전문지', time: '2시간 전' },
    ],
  },
  {
    rank: 19, name: '한국전력', code: '015760', sector: '에너지', price: '21,350원', volume: '1.4M', changePct: 0.2,
    aiReason: '전기요금 인상 기대감이 지속되며 저가 매수세가 유입됐습니다.',
    aiComment: '요금 정상화 일정이 구체화될 경우 추가 상승 여력이 있습니다.',
    similar: ['한국가스공사', '지역난방공사', 'SK가스'],
    news: [
      { title: '산업부, 하반기 전기요금 조정 검토 착수', source: '에너지뉴스', time: '5시간 전' },
    ],
  },
  {
    rank: 20, name: '넥슨', code: '225570', sector: '게임', price: '47,800원', volume: '1.3M', changePct: 3.1,
    aiReason: '메이플스토리 신규 콘텐츠 흥행과 일본 법인 실적 호조가 주가를 견인했습니다.',
    aiComment: '글로벌 IP 확장 전략이 성과를 내고 있어 긍정적입니다.',
    similar: ['크래프톤', '엔씨소프트', '넷마블'],
    news: [
      { title: '넥슨 메이플스토리 신규 직업 출시 흥행', source: '게임뉴스', time: '4시간 전' },
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
  { bot: 'Claude', icon: 'https://www.google.com/s2/favicons?domain=anthropic.com&sz=64', stockName: 'SK하이닉스', reason: 'HBM 대형 계약 소식으로 단기 상승 모멘텀 강함', signal: '매수' },
  { bot: 'Gemini', icon: 'https://www.google.com/s2/favicons?domain=gemini.google.com&sz=64', stockName: 'SK하이닉스', reason: '실적 서프라이즈로 외국인 순매수 지속 예상', signal: '매수' },
  { bot: 'Gemini', icon: 'https://www.google.com/s2/favicons?domain=gemini.google.com&sz=64', stockName: '삼성전자', reason: '반도체 업황 개선 기대감이 리포트에서 동시 언급', signal: '매수' },
  { bot: 'Perplexity', icon: 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=64', stockName: '삼성전자', reason: '파운드리 신규 수주로 중장기 실적 개선 기대', signal: '매수' },
  { bot: 'ChatGPT', icon: 'https://www.google.com/s2/favicons?domain=openai.com&sz=64', stockName: '삼성전자', reason: '단기 급등 이후 차익 실현 매물 주의 필요', signal: '중립' },
  { bot: 'ChatGPT', icon: 'https://www.google.com/s2/favicons?domain=openai.com&sz=64', stockName: '카카오', reason: '규제 확정 전까지 변동성 지속 가능성 주의', signal: '중립' },
  { bot: 'Claude', icon: 'https://www.google.com/s2/favicons?domain=anthropic.com&sz=64', stockName: '카카오', reason: '과거 유사 규제 이슈 때 저점 매수 기회로 작용', signal: '중립' },
  { bot: 'Perplexity', icon: 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=64', stockName: '포스코퓨처엠', reason: '소재 가격 하락 전망으로 하락 압력 감지', signal: '매도' },
  { bot: 'Gemini', icon: 'https://www.google.com/s2/favicons?domain=gemini.google.com&sz=64', stockName: '포스코퓨처엠', reason: '2차전지 섹터 전반 조정 국면, 단기 관망 권고', signal: '매도' },
  { bot: 'Claude', icon: 'https://www.google.com/s2/favicons?domain=anthropic.com&sz=64', stockName: '한미약품', reason: '임상 3상 긍정 결과로 글로벌 기술이전 기대감 상승', signal: '매수' },
  { bot: 'ChatGPT', icon: 'https://www.google.com/s2/favicons?domain=openai.com&sz=64', stockName: 'NAVER', reason: 'AI 검색 경쟁 심화로 점유율 방어 여부 불확실', signal: '중립' },
];

export const orderbook: OrderbookEntry[] = [
  { price: '78,400원', qty: '1,240', dir: 'down' },
  { price: '78,300원', qty: '3,110', dir: 'down' },
  { price: '78,200원', qty: '5,032', dir: 'mid' },
  { price: '78,100원', qty: '2,880', dir: 'up' },
  { price: '78,000원', qty: '1,760', dir: 'up' },
];

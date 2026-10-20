// 종목 상세 화면의 여러 패널이 함께 쓰는 AI 의견 표기

export const REC_LABEL: Record<string, '매수' | '매도' | '중립'> = {
  BUY: '매수',
  HOLD: '중립',
  SELL: '매도',
};

export const BOT_META = {
  Gemini: { icon: 'https://www.google.com/s2/favicons?domain=gemini.google.com&sz=64' },
  GPT: { icon: 'https://www.google.com/s2/favicons?domain=openai.com&sz=64' },
  CLOVA: { icon: 'https://www.google.com/s2/favicons?domain=naver.com&sz=64' },
} as const;

export type BotName = keyof typeof BOT_META;
export type Signal = '매수' | '매도' | '중립';

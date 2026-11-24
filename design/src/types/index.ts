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
  // 패널 위에 쓰는 브랜드색 글자(링크·활성 탭). ai는 버튼 배경용이라 다크 모드에서 글자로 쓰면 대비가 부족하다
  aiFg: string;
  // 상태 색: 글자로 써도 패널 위 대비 4.5:1 이상. soft는 같은 색의 옅은 배경
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  error: string;
  errorSoft: string;
  // 입력창 테두리. 일반 border는 구분선용이라 옅고, 입력창 경계는 3:1 이상이어야 한다
  inputBorder: string;
}

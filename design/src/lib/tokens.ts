// 디자인 토큰. 화면마다 숫자를 직접 쓰지 말고 여기 이름으로 쓴다.
// 근거: 한 화면의 글자 크기는 4~5단계 이내, 본문은 14px 이상, 굵기·둥글기도 몇 단계로만 관리한다.

// 글자 크기 5단계
export const FS = {
  caption: 12, // 보조 정보·날짜·단위
  body: 14, // 본문·목록·입력값
  title: 16, // 카드 제목·강조 수치
  heading: 20, // 섹션·페이지 제목
  display: 28, // 히어로·대표 가격
} as const;

// 굵기 3단계 (기본 400은 따로 지정하지 않는다)
export const FW = {
  medium: 500, // 라벨·탭
  semibold: 600, // 제목·버튼
  bold: 700, // 핵심 수치·페이지 제목
} as const;

// 간격(padding·margin·gap) 단계. 4px 배수만 쓴다 (2는 세그먼트 버튼 안쪽처럼 아주 좁은 틈 전용).
// 원칙: 요소 안쪽 < 같은 그룹 사이 < 섹션 사이. 예) 카드 안 8~12, 카드끼리 12~16, 섹션끼리 24~32.
// 새로 쓸 때도 이 값 중에서 고른다. 문자열('12px 16px')로 쓸 때도 같은 값만 쓴다
export const SPACE = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80] as const;

// 브랜드 그라데이션. 배너·로고·CTA 모두 이 하나만 쓴다 (화면마다 2단/3단으로 달랐던 것을 통일)
export const BRAND_GRADIENT = 'linear-gradient(135deg, #4361ee 0%, #7B5EA7 60%, #3B4FC8 100%)';

// 브랜드 그라데이션 위에 쓰는 상승/하락 색.
// theme.up(#d41929)·theme.down(#4361ee)과 색상(hue)은 같고, 어두운 배경에서 읽히게 밝힌 색.
// 둘의 명도·채도는 서로 같게 맞춘다 (OKLCH L 0.85, C 0.07)
export const ON_BRAND = {
  up: '#f9bdb7',
  down: '#bbcdfd',
} as const;

// 모서리 둥글기 5단계
export const RADIUS = {
  sm: 4, // 작은 배지·체크박스
  md: 8, // 버튼·입력창·작은 카드
  lg: 12, // 카드·패널
  xl: 16, // 모달·히어로 배너
  pill: 999, // 알약 모양 칩·토글
} as const;

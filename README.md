# 모의투자 - Design

AI 기반 모의투자 앱의 화면 디자인 프로젝트입니다.

## 화면 구성

| 화면 | 경로 | 설명 |
|------|------|------|
| 로그인 | `/login` | 이메일 / 소셜 로그인 |
| 메인 | `/` | 실시간 거래량 랭킹 + AI 추천 |
| 종목 상세 | `/stock/:code` | 차트, 매수/매도, 뉴스, AI 인사이트 |
| 포트폴리오 | `/portfolio` | 보유 종목 현황 + 거래 내역 |

## 시작하기

**요구사항:** Node.js 18 이상

```bash
# 1. 저장소 클론
git clone https://github.com/puri0822-new/moigo.git
cd moigo

# 2. design 브랜치로 이동
git checkout design

# 3. design 폴더로 이동 후 패키지 설치
cd design
npm install

# 4. 개발 서버 실행
npm run dev
```

실행 후 브라우저에서 `http://localhost:5173` 접속

## 기술 스택

- React 18
- TypeScript
- Vite
- React Router v6

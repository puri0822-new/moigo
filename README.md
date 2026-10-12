# 모이고 (Moigo)

AI 뉴스 분석 기반 모의투자 웹 서비스

## 화면 구성

| 화면 | 경로 | 설명 |
|------|------|------|
| 로그인 | `/login` | 이메일 / 소셜 로그인 |
| 메인 | `/` | 실시간 거래량 랭킹 + AI 추천 |
| 종목 상세 | `/stock/:code` | 차트, 매수/매도, 뉴스, AI 인사이트 |
| 포트폴리오 | `/portfolio` | 보유 종목 현황 + 거래 내역 |

## 기술 스택

- Frontend: React 18 + TypeScript + Vite
- Backend: Python FastAPI
- DB: PostgreSQL + Redis

## 시작하기

**요구사항:** Node.js 18 이상

```bash
git clone https://github.com/puri0822-new/moigo.git
cd moigo

# 프론트엔드
git checkout design
cd design
npm install
npm run dev
```

실행 후 브라우저에서 `http://localhost:5173` 접속

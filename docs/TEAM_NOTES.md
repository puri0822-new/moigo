# backend_D 받은 뒤 팀원이 할 일

`backend_D`를 pull하거나 merge한 뒤 아래를 확인해 주세요. 마지막 갱신: 2026-10-20 (`125cc6b`)

## 1. 꼭 해야 할 것

### DB 마이그레이션 실행

이미 만들어 둔 DB가 있다면 아래 SQL을 **순서대로** 실행하세요. 모두 여러 번 실행해도 안전합니다.
DB를 새로 만든다면 `docs/schema.sql`만 실행하면 됩니다.

```bash
psql -d moigo -f docs/migrations/002_community.sql
psql -d moigo -f docs/migrations/003_post_image.sql
psql -d moigo -f docs/migrations/004_ai_recommendations.sql
psql -d moigo -f docs/migrations/005_watchlist_notifications.sql
psql -d moigo -f docs/migrations/006_ai_model_clova.sql
psql -d moigo -f docs/migrations/007_stock_ai_reasons.sql
```

| 파일 | 내용 | 실행하지 않으면 |
|---|---|---|
| `002_community.sql` | 피드 글·좋아요·댓글 테이블 | 피드 API 오류 |
| `003_post_image.sql` | 피드 글 사진 칸 (`posts.image_url`) | 피드 목록·글쓰기 오류 |
| `004_ai_recommendations.sql` | AI 모델·추천·결과·근거 테이블 | AI 관련 API 오류 |
| `005_watchlist_notifications.sql` | 관심 종목·알림 테이블, `users.price_alert_enabled` | **회원 설정 페이지(`/users/me`)가 열리지 않음**, 관심 종목·알림 API 오류 |
| `006_ai_model_clova.sql` | AI 모델 목록에 CLOVA 추가, 추천 한 줄 요약(`summary`) | AI 추천 API 오류 |
| `007_stock_ai_reasons.sql` | 종목 상세 AI 등락 이유 저장 | 종목 상세의 등락 이유가 "준비 중"으로만 나옴 |

### `.env` 키 확인 (`backend/.env`)

`backend/.env.example`에 네이버 뉴스 검색 키를 추가했습니다. 기존 `.env`에 아래 두 줄이 없으면 넣어 주세요.

```
NAVER_CLIENT_ID=        # 뉴스 검색 (NCP API HUB)
NAVER_CLIENT_SECRET=
```

`.env`와 `backend/uploads/`(피드 사진)는 커밋하지 않습니다.

### 토스증권 API: IP 등록

토스 API는 허용한 IP에서만 동작합니다. 네트워크(집, 학교, 카페)가 바뀌면 아래 오류가 납니다.

```
403 {"error":"access_denied","error_description":"IP address not allowed"}
```

이때는 `curl ifconfig.me`로 현재 공인 IP를 확인하고, 토스증권 개발자 콘솔의 허용 IP에 추가하세요.
토스 호출이 실패하면 가격 칸이 비거나(`null`), 손익이 0원으로 보입니다.

## 2. 알아 둘 동작 변경

### 토스 토큰 (401 자동 복구)
- 서버가 토스에서 401을 받으면, 토큰을 새로 받아 한 번 다시 시도합니다 (`app/core/toss_client.py`의 `_api_get`)
- 서버를 켠 채로 다른 스크립트에서 같은 키로 토스 토큰을 새로 받으면, 서버가 쓰던 토큰이 끊기는 것으로 보입니다. 지금은 위 재시도로 자동 복구됩니다

### 주문 체결 가격
- 사용자가 입력한 가격은 무시하고 **토스 현재가로 즉시 체결**합니다
- 2026-10-13 15:12 커밋(`ae0a537`) 이전에 들어간 주문은 목업 가격이나 입력 가격(예: 78,200원, 1,000원)으로 체결됐을 수 있습니다. 테스트 계좌의 수익이 이상하면 이 때문입니다

### 계좌 금액 자동 갱신
- 오른쪽 패널, 종목 상세, 내 계좌가 `/portfolio`를 **30초마다** 다시 불러옵니다 (`design/src/lib/usePolling.ts`)
- 백엔드는 토스 현재가를 60초 캐시합니다. 그래서 숫자는 최대 1분 단위로 바뀝니다

### 보유 종목 카드
- 윗줄: **평가금액** (현재가 × 수량). 예전에는 평균 매수가를 보여줬습니다
- 아랫줄: 평균 매수가 대비 전체 손익 `±금액 (%)`

### 관심 종목·급등락 알림
- 종목 상세의 🔔 버튼은 없앴습니다. ♡ 하나로 관심 종목에 추가하고, 이어서 "5% 오르내리면 알릴까요?"를 묻습니다
- 알림 기준: 전일 종가 대비 ±5%, ±10%, ±15%… 단계를 넘을 때. 같은 날 같은 단계는 한 번만 알립니다
- **백그라운드 작업은 없습니다.** 헤더 🔔가 30초마다 `GET /v1/notifications`를 부를 때 서버가 계산합니다. 그래서 접속하지 않은 동안의 급등락은 놓칠 수 있습니다
- 알림 삭제는 행을 지우지 않고 `deleted_at`만 채웁니다. 행을 지우면 같은 알림이 다시 생깁니다
- 회원 설정의 "관심 종목 급등락 알림" 스위치(`users.price_alert_enabled`)를 끄면 새 알림을 만들지 않습니다

## 3. 새 API

모두 로그인이 필요합니다 (`Authorization: Bearer ...`).

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/v1/users/me` | 내 정보 (`price_alert_enabled` 포함) |
| PATCH | `/v1/users/me` | 닉네임, 마케팅 동의, `price_alert_enabled` 수정 |
| PUT | `/v1/users/me/password` | 비밀번호 변경 |
| POST | `/v1/users/me/withdraw` | 회원 탈퇴 |
| GET | `/v1/watchlist` | 관심 종목 목록 (현재가, 전일 대비 금액·%) |
| POST | `/v1/watchlist` | 관심 종목 추가 `{ stock_id, alert_enabled }` |
| PATCH | `/v1/watchlist/{stock_id}` | 종목별 알림 켜기·끄기 `{ alert_enabled }` |
| DELETE | `/v1/watchlist/{stock_id}` | 관심 종목에서 빼기 |
| GET | `/v1/notifications` | 알림 목록 최근 30개와 안 읽은 수 (호출할 때 급등락 계산) |
| POST | `/v1/notifications/read-all` | 모두 읽음 |
| DELETE | `/v1/notifications` | 알림 전체 삭제 |
| DELETE | `/v1/notifications/{id}` | 알림 하나 삭제 |

## 4. AI 추천 (AI 분석 페이지)

- **Claude(Opus 5.5), Gemini, CLOVA(HCX-005)**가 추천을 만듭니다. 키가 없는 모델은 추천을 만들지 않고 AI 분석 화면에서도 숨깁니다
- 키는 `backend/.env`의 `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `CLOVA_API_KEY`에 넣습니다 (`.env.example` 참고). 키는 따로 전달합니다
- Claude는 공식 SDK(`anthropic`)를 씁니다. **`pip install -r requirements.txt`를 다시 실행하세요**
- **언제**: 서버 안의 스케줄러가 10분마다 확인해서, 평일 16시(KST) 이후이고 그날 장이 열렸으면 모델마다 하루 한 번 추천을 만듭니다. 주말·휴장일에는 만들지 않습니다
- **무엇을**: 30개 종목의 최신 네이버 뉴스를 보고 1주 추천 3개와 1달 추천 2개를 냅니다. 근거 뉴스는 실제 수집한 기사 중에서만 고르게 해서, 지어낸 기사가 나오지 않습니다
- **채점**: 1주/1달 뒤 종가로 채점합니다(주말이면 직전 거래일 종가). 매수는 오르면, 매도는 내리면 적중입니다. 틀린 추천은 같은 AI가 실패 이유를 씁니다
- 결과는 DB에 저장됩니다. 화면은 저장된 것을 읽기만 하므로, 새로고침해도 AI를 다시 부르지 않습니다
- **같은 DB를 여러 서버가 쓰면** 한 서버만 `AI_SCHEDULER_ENABLED=true`로 두세요
- 손으로 실행할 때 (backend 폴더에서):
  ```bash
  venv/bin/python -m app.jobs.ai_jobs generate                       # 오늘 추천이 없는 모델만
  venv/bin/python -m app.jobs.ai_jobs generate --model CLOVA --force # 다시 만들기 (장중이면 그 순간 가격이 추천가가 됨)
  venv/bin/python -m app.jobs.ai_jobs evaluate                       # 채점
  ```
- 새 API: `GET /v1/ai/recommendations` (모든 추천과 근거 뉴스, 채점 결과)
- **종목 상세 AI 인사이트**: 등락 이유는 상세 페이지를 열 때 AI(Claude, 없으면 Gemini→CLOVA)가 오늘 등락률·코스피/코스닥·최신 뉴스로 씁니다. 종목·거래일마다 저장하고 장중에는 1시간마다만 새로 씁니다 (`GET /v1/ai/stocks/{code}/reason`). AI 종합 의견·AI별 코멘트는 그 종목의 채점 전 추천, 유사 종목은 같은 업종 (`GET /v1/stocks/{id}/similar`)

## 5. 아직 임시인 것

- **랜딩 페이지**의 AI 분석 화면 캡처(`design/public/screenshots/ai-*.webp`)는 예전 더미 데이터로 찍었습니다. 그래서 "예시입니다" 안내를 붙였습니다. 실제 추천과 채점 결과가 쌓이면 다시 찍어 교체해야 합니다

# 모이고 API 명세서

## 공통 사항

- Base URL: `https://api.moigo.com/v1`
- 인증 방식: JWT Bearer Token
- 요청/응답 형식: `application/json`
- 인증이 필요한 API는 Header에 아래 포함

```
Authorization: Bearer {access_token}
```

### 공통 응답 형식
```json
{
  "success": true,
  "data": { ... },
  "message": "요청 성공"
}
```

### 공통 에러 응답
```json
{
  "success": false,
  "data": null,
  "message": "에러 메시지"
}
```

### HTTP 상태 코드
| 코드 | 설명 |
|------|------|
| 200 | 요청 성공 |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 중복 데이터 |
| 500 | 서버 오류 |

---

## 1. 인증 (Auth)

### 1-1. 회원가입
`POST /auth/signup`

**인증 불필요**

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "mypassword123",
  "nickname": "투자초보"
}
```

**Response 201**
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "email": "user@example.com",
    "nickname": "투자초보"
  },
  "message": "회원가입 성공"
}
```

**Error**
| 코드 | 메시지 |
|------|--------|
| 409 | 이미 사용 중인 이메일입니다 |

---

### 1-2. 로그인 (LOCAL)
`POST /auth/login`

**인증 불필요**

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGci...",
    "token_type": "bearer"
  },
  "message": "로그인 성공"
}
```

**Error**
| 코드 | 메시지 |
|------|--------|
| 401 | 이메일 또는 비밀번호가 올바르지 않습니다 |

---

### 1-3. 구글 로그인
`POST /auth/google`

**인증 불필요**

**Request Body**
```json
{
  "google_token": "구글에서 받은 ID 토큰"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGci...",
    "token_type": "bearer"
  },
  "message": "로그인 성공"
}
```

---

### 1-4. 로그아웃
`POST /auth/logout`

**인증 필요**

**Response 200**
```json
{
  "success": true,
  "data": null,
  "message": "로그아웃 성공"
}
```

---

## 2. 종목 (Stocks)

### 2-1. 종목 목록 조회
`GET /stocks`

**인증 불필요**

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "005930",
      "name": "삼성전자",
      "market": "KOSPI",
      "sector": "전기전자",
      "current_price": 75000,
      "change_rate": 1.35
    }
  ],
  "message": "요청 성공"
}
```

---

### 2-2. 종목 상세 조회
`GET /stocks/{stock_id}`

**인증 불필요**

**Path Parameter**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| stock_id | integer | 종목 ID |

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "005930",
    "name": "삼성전자",
    "market": "KOSPI",
    "sector": "전기전자",
    "current_price": 75000,
    "change_rate": 1.35,
    "volume": 12345678
  },
  "message": "요청 성공"
}
```

**Error**
| 코드 | 메시지 |
|------|--------|
| 404 | 종목을 찾을 수 없습니다 |

---

## 3. 뉴스 (News)

### 3-1. 종목별 뉴스 조회
`GET /stocks/{stock_id}/news`

**인증 불필요**

**Path Parameter**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| stock_id | integer | 종목 ID |

**Query Parameter**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| limit | integer | N | 조회 개수 (기본값: 10) |

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "삼성전자, 3분기 실적 발표...",
      "summary": "삼성전자가 3분기 영업이익...",
      "url": "https://news.example.com/...",
      "source": "연합뉴스",
      "published_at": "2026-09-15T09:00:00"
    }
  ],
  "message": "요청 성공"
}
```

### 3-2. 종목별 핵심 이슈 조회
`GET /stocks/{stock_id}/news/top`

**인증 불필요**

최근 7일 기사(네이버 최신순·정확도순 각 100건)를 제목이 비슷한 것끼리 하나의 사건으로 묶고,
보도한 언론사 수 + 중요 키워드(실적·공시·수주·급등 등) 가산점으로 순위를 매기고, 수상·행사·후원 같은 보도자료성 이슈는 점수를 크게 깎는다.
언론사 2곳 이상이 다뤘거나 중요 키워드가 있는 이슈만 내려준다. 종목별 10분 캐시.
각 이슈가 이 종목 주가에 호재/중립/악재인지 AI(Gemini → Claude → CLOVA 중 키가 있는 첫 모델)가 판단해 `sentiment`(`POSITIVE`/`NEUTRAL`/`NEGATIVE`)와 `sentiment_reason`으로 내려준다.
종목의 이슈를 한 번에 판단하고 (종목, 기사 주소)별로 6시간 캐시한다. 판단이 6초 안에 끝나지 않거나 실패하면 두 필드는 `null`이다 (늦게 끝난 판단은 다음 요청에 반영).

**Query Parameter**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| limit | integer | N | 조회 개수 (기본값: 5, 최대 10) |

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "삼성전자 20만원·SK하이닉스 120만원 탈환…반도체주 동반 급등",
      "summary": "...",
      "url": "https://news.example.com/...",
      "source": "www.example.com",
      "published_at": "2026-11-10T12:30:00+09:00",
      "image_url": "https://...",
      "first_published_at": "2026-11-10T09:10:00+09:00",
      "latest_published_at": "2026-11-10T13:40:00+09:00",
      "article_count": 18,
      "source_count": 17,
      "tags": ["급등"],
      "related": [
        { "title": "...", "url": "...", "source": "...", "published_at": "2026-11-10T13:40:00+09:00" }
      ],
      "sentiment": "POSITIVE",
      "sentiment_reason": "반도체 업황 회복 기대로 동반 급등해 호재다"
    }
  ],
  "message": "요청 성공"
}
```

**Error**
| 코드 | message |
|------|---------|
| 404 | 종목을 찾을 수 없습니다 |
| 502 | 핵심 이슈를 불러오지 못했습니다 |

### 3-3. 시장 핵심 뉴스 조회 (뉴스 탭)
`GET /news/issues`

**인증 불필요**

시세 캐시 기준 거래대금 상위 10종목의 핵심 이슈(3-2)를 모아 점수 순으로 내려준다.
기사 주소가 겹치는 이슈(한 사건이 여러 종목에 걸린 경우)는 하나로 합치고 `stocks`에 종목을 함께 담는다.
합친 이슈의 `sentiment`는 대표 기사를 고른 종목(점수가 가장 높은 쪽) 기준이다.
처음 호출은 수십 초까지 걸릴 수 있고, 이후 종목별 10분 캐시.

**Query Parameter**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| limit | integer | N | 조회 개수 (기본값: 15, 최대 30) |

**Response 200**: 3-2의 항목에 `stocks` 필드가 추가된다.
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "BMW, 삼성SDI·LG엔솔과 배터리 공급 계약",
      "...": "3-2와 같은 필드",
      "stocks": [
        { "id": 12, "code": "006400", "name": "삼성SDI" },
        { "id": 5, "code": "373220", "name": "LG에너지솔루션" }
      ]
    }
  ],
  "message": "요청 성공"
}
```

---

## 4. AI 분석 (AI Analysis)

### 4-1. 종목별 최신 AI 분석 조회
`GET /stocks/{stock_id}/analysis`

**인증 불필요**

**Path Parameter**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| stock_id | integer | 종목 ID |

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "stock_id": 1,
    "gemini_result": "삼성전자는 3분기 실적 호조로...",
    "claude_result": "최근 반도체 업황 회복세로...",
    "gemini_recommendation": "BUY",
    "claude_recommendation": "BUY",
    "is_matched": true,
    "sentiment": "POSITIVE",
    "price_at_analysis": 75000,
    "analyzed_at": "2026-09-15T08:00:00",
    "related_news": [
      {
        "id": 1,
        "title": "삼성전자, 3분기 실적 발표...",
        "source": "연합뉴스",
        "published_at": "2026-09-15T09:00:00"
      }
    ]
  },
  "message": "요청 성공"
}
```

**Error**
| 코드 | 메시지 |
|------|--------|
| 404 | 분석 결과가 없습니다 |

---

### 4-2. AI 분석 실행 요청
`POST /stocks/{stock_id}/analysis`

**인증 필요**

**Path Parameter**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| stock_id | integer | 종목 ID |

**Response 201**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "stock_id": 1,
    "analyzed_at": "2026-09-15T10:00:00"
  },
  "message": "분석이 완료되었습니다"
}
```

---

## 5. 주문 (Orders)

### 5-1. 주문 (매수 / 매도)
`POST /orders`

**인증 필요**

**Request Body**
```json
{
  "stock_id": 1,
  "order_type": "BUY",
  "quantity": 10,
  "ai_analysis_id": 1
}
```

**Response 201**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "stock_id": 1,
    "stock_name": "삼성전자",
    "order_type": "BUY",
    "quantity": 10,
    "price": 75000,
    "total_amount": 750000,
    "ordered_at": "2026-09-15T10:00:00"
  },
  "message": "주문이 체결되었습니다"
}
```

**Error**
| 코드 | 메시지 |
|------|--------|
| 400 | 잔고가 부족합니다 |
| 400 | 보유 수량이 부족합니다 (매도 시) |

---

### 5-2. 주문 내역 조회
`GET /orders`

**인증 필요**

**Query Parameter**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| stock_id | integer | N | 종목 필터 |
| order_type | string | N | BUY / SELL 필터 |
| limit | integer | N | 조회 개수 (기본값: 20) |

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "stock_name": "삼성전자",
      "order_type": "BUY",
      "quantity": 10,
      "price": 75000,
      "total_amount": 750000,
      "ordered_at": "2026-09-15T10:00:00",
      "ai_analysis": {
        "gemini_recommendation": "BUY",
        "claude_recommendation": "BUY",
        "is_matched": true
      }
    }
  ],
  "message": "요청 성공"
}
```

---

## 6. 계좌 (Account)

### 6-1. 계좌 정보 조회
`GET /account`

**인증 필요**

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "balance": 9250000,
    "initial_balance": 10000000,
    "total_profit_loss": -750000,
    "profit_loss_rate": -7.5
  },
  "message": "요청 성공"
}
```

---

## 7. 포트폴리오 (Portfolio)

### 7-1. 보유 종목 조회
`GET /portfolio`

**인증 필요**

**Response 200**
```json
{
  "success": true,
  "data": {
    "total_eval_amount": 760000,
    "total_profit_loss": 10000,
    "total_profit_loss_rate": 1.33,
    "holdings": [
      {
        "stock_id": 1,
        "stock_name": "삼성전자",
        "quantity": 10,
        "avg_price": 75000,
        "current_price": 76000,
        "eval_amount": 760000,
        "profit_loss": 10000,
        "profit_loss_rate": 1.33
      }
    ]
  },
  "message": "요청 성공"
}
```

---

### 7-2. 매매 히스토리 및 복기
`GET /portfolio/history`

**인증 필요**

**Query Parameter**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| stock_id | integer | N | 종목 필터 |
| limit | integer | N | 조회 개수 (기본값: 20) |

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "stock_name": "삼성전자",
      "order_type": "BUY",
      "quantity": 10,
      "price": 75000,
      "total_amount": 750000,
      "ordered_at": "2026-09-15T10:00:00",
      "ai_analysis": {
        "gemini_result": "삼성전자는 3분기 실적 호조로...",
        "claude_result": "최근 반도체 업황 회복세로...",
        "gemini_recommendation": "BUY",
        "claude_recommendation": "BUY",
        "is_matched": true,
        "sentiment": "POSITIVE"
      }
    }
  ],
  "message": "요청 성공"
}
```

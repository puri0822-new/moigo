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

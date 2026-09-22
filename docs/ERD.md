# 모이고 ERD 설계

## 엔티티 관계 요약

```
User 1 ──── 1 Account
User 1 ──── N Order
User 1 ──── N Holding

Account 1 ──── N Order

Stock 1 ──── N News
Stock 1 ──── N AiAnalysis
Stock 1 ──── N Order
Stock 1 ──── N Holding

News N ──── N AiAnalysis (AiAnalysisNews 중간 테이블)
Order N ──── 1 AiAnalysis (매매 당시 분석 참조, nullable)
```

---

## 테이블 정의

### User (사용자)
| Field (한국어) | Field2 (영문) | Domain | Type | Null 여부 | Default Value |
|--------------|-------------|--------|------|-----------|---------------|
| 사용자 ID | id | PK | BIGINT | NOT NULL | AUTO_INCREMENT |
| 이메일 | email | UNIQUE | VARCHAR(255) | NOT NULL | - |
| 비밀번호 | password_hash | - | VARCHAR(255) | NULL | NULL |
| 닉네임 | nickname | - | VARCHAR(50) | NOT NULL | - |
| 로그인 방식 | login_type | - | VARCHAR(20) | NOT NULL | 'LOCAL' |
| 소셜 ID | social_id | - | VARCHAR(255) | NULL | NULL |
| 가입일시 | created_at | - | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP |
| 수정일시 (자동 갱신 트리거) | updated_at | - | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP |

---

### Account (가상계좌) — User와 1:1
| Field (한국어) | Field2 (영문) | Domain | Type | Null 여부 | Default Value |
|--------------|-------------|--------|------|-----------|---------------|
| 계좌 ID | id | PK | BIGINT | NOT NULL | AUTO_INCREMENT |
| 사용자 ID | user_id | FK(User) UNIQUE | BIGINT | NOT NULL | - |
| 가용 잔고 | balance | CHECK (balance >= 0) | BIGINT | NOT NULL | 10000000 |
| 초기 자본금 | initial_balance | - | BIGINT | NOT NULL | 10000000 |
| 계좌 생성일시 | created_at | - | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP |
| 수정일시 (자동 갱신 트리거) | updated_at | - | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP |

---

### Stock (종목)
| Field (한국어) | Field2 (영문) | Domain | Type | Null 여부 | Default Value |
|--------------|-------------|--------|------|-----------|---------------|
| 종목 ID | id | PK | BIGINT | NOT NULL | AUTO_INCREMENT |
| 종목 코드 | code | UNIQUE | VARCHAR(20) | NOT NULL | - |
| 종목명 | name | - | VARCHAR(100) | NOT NULL | - |
| 시장 구분 | market | - | VARCHAR(20) | NOT NULL | 'KOSPI' |
| 업종 | sector | - | VARCHAR(100) | NULL | NULL |
| 등록일시 | created_at | - | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP |

---

### News (뉴스)
| Field (한국어) | Field2 (영문) | Domain | Type | Null 여부 | Default Value |
|--------------|-------------|--------|------|-----------|---------------|
| 뉴스 ID | id | PK | BIGINT | NOT NULL | AUTO_INCREMENT |
| 종목 ID | stock_id | FK(Stock) | BIGINT | NOT NULL | - |
| 뉴스 제목 | title | - | VARCHAR(500) | NOT NULL | - |
| 뉴스 요약 | summary | - | TEXT | NULL | NULL |
| 원문 URL | url | - | VARCHAR(1000) | NOT NULL | - |
| 출처 매체 | source | - | VARCHAR(100) | NULL | NULL |
| 뉴스 발행일시 | published_at | - | TIMESTAMPTZ | NOT NULL | - |
| 수집일시 | collected_at | - | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP |

---

### AiAnalysis (AI 분석 결과)
| Field (한국어) | Field2 (영문) | Domain | Type | Null 여부 | Default Value |
|--------------|-------------|--------|------|-----------|---------------|
| 분석 ID | id | PK | BIGINT | NOT NULL | AUTO_INCREMENT |
| 종목 ID | stock_id | FK(Stock) | BIGINT | NOT NULL | - |
| Gemini 분석 내용 | gemini_result | - | TEXT | NULL | NULL |
| Claude 분석 내용 | claude_result | - | TEXT | NULL | NULL |
| Gemini 추천 | gemini_recommendation | - | VARCHAR(20) | NULL | NULL |
| Claude 추천 | claude_recommendation | - | VARCHAR(20) | NULL | NULL |
| AI 결과 일치 여부 | is_matched | - | BOOLEAN | NULL | NULL |
| 투자심리 | sentiment | - | VARCHAR(20) | NULL | NULL |
| 분석 시점 주가 | price_at_analysis | - | BIGINT | NULL | NULL |
| 분석 실행일시 | analyzed_at | - | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP |

---

### AiAnalysisNews (AI분석-뉴스 중간 테이블)
| Field (한국어) | Field2 (영문) | Domain | Type | Null 여부 | Default Value |
|--------------|-------------|--------|------|-----------|---------------|
| 분석 ID | ai_analysis_id | PK, FK(AiAnalysis) | BIGINT | NOT NULL | - |
| 뉴스 ID | news_id | PK, FK(News) | BIGINT | NOT NULL | - |

---

### Order (주문 내역)
| Field (한국어) | Field2 (영문) | Domain | Type | Null 여부 | Default Value |
|--------------|-------------|--------|------|-----------|---------------|
| 주문 ID | id | PK | BIGINT | NOT NULL | AUTO_INCREMENT |
| 사용자 ID | user_id | FK(User) | BIGINT | NOT NULL | - |
| 계좌 ID | account_id | FK(Account) | BIGINT | NOT NULL | - |
| 종목 ID | stock_id | FK(Stock) | BIGINT | NOT NULL | - |
| AI 분석 ID | ai_analysis_id | FK(AiAnalysis) | BIGINT | NULL | NULL |
| 주문 유형 | order_type | - | VARCHAR(10) | NOT NULL | - |
| 주문 수량 | quantity | - | INT | NOT NULL | - |
| 체결 가격 | price | - | BIGINT | NOT NULL | - |
| 총 거래금액 | total_amount | CHECK (total_amount = price * quantity) | BIGINT | NOT NULL | - |
| 주문 체결일시 | ordered_at | - | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP |

---

### Holding (보유 종목)
| Field (한국어) | Field2 (영문) | Domain | Type | Null 여부 | Default Value |
|--------------|-------------|--------|------|-----------|---------------|
| 보유 ID | id | PK | BIGINT | NOT NULL | AUTO_INCREMENT |
| 사용자 ID | user_id | FK(User), 복합 UNIQUE(user_id, stock_id) | BIGINT | NOT NULL | - |
| 종목 ID | stock_id | FK(Stock), 복합 UNIQUE(user_id, stock_id) | BIGINT | NOT NULL | - |
| 보유 수량 | quantity | - | INT | NOT NULL | - |
| 평균 매수가 | avg_price | - | BIGINT | NOT NULL | - |
| 수정일시 (자동 갱신 트리거) | updated_at | - | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP |

---

## 관계 다이어그램

```
[User] ──1:1── [Account]
  │
  ├──1:N── [Order] ──N:1── [Stock] ──1:N── [News]
  │            │                │               │
  │            └──N:1── [AiAnalysis] ──N:N── [AiAnalysisNews]
  │                                               │
  └──1:N── [Holding] ──N:1── [Stock]         (News 참조)
```

---

## 설계 핵심 포인트

1. **Account.balance** 는 매수 시 차감, 매도 시 증가로 실시간 관리
2. **Holding** 은 user_id + stock_id 복합 유니크 → 같은 종목 중복 행 방지, 매수 시 avg_price 갱신
3. **Order.ai_analysis_id** 는 nullable → AI 분석 없이도 주문 가능, 있으면 복기 기능 연결
4. **AiAnalysis** 는 Gemini/Claude 결과를 한 행에 저장 → 비교 쿼리 단순화
5. **News.collected_at** 과 **published_at** 분리 → 수집 시점과 발행 시점 구분 가능
6. **User.login_type** 으로 로그인 방식 구분 → LOCAL이면 password_hash 필수, GOOGLE이면 social_id 필수
   - password_hash는 GOOGLE 로그인 사용자에 한해 NULL 허용 (의도된 설계)
   - 테이블 분리(users / user_local / user_social) 방식도 있으나 아래 이유로 단일 테이블 채택
     - 로그인할 때마다 JOIN 쿼리 필요 → 코드 복잡도 증가
     - 관리할 테이블이 1개 → 3개로 늘어남
     - 로그인 방식이 2가지뿐인 현재 규모에서는 과한 설계
7. **모든 타임스탬프 컬럼은 TIMESTAMPTZ** 사용 → 수집 데이터(네이버 뉴스 pubDate, 토스 API timestamp)가 전부 타임존 정보를 포함하므로, 저장 시 타임존 유실/혼동 방지
8. **News.source는 NULL 허용** → 네이버 뉴스 검색 API 응답에 언론사명 필드가 없어, 수집 시점에 값이 없을 수 있음 (추후 `originallink` 기반 추정 로직 도입 시 채워질 수 있음)
9. **Account.balance는 CHECK (balance >= 0)** 로 음수 잔고 방지 → 동시 주문 등으로 인한 자금 무결성 훼손을 DB 레벨에서도 방어
10. **Order.total_amount는 CHECK (total_amount = price * quantity)** 로 애플리케이션 계산 버그를 DB 레벨에서 차단
11. **users/accounts/holdings의 updated_at은 `BEFORE UPDATE` 트리거로 자동 갱신** → 애플리케이션에서 매번 명시적으로 갱신하지 않아도 정확한 수정일시 유지

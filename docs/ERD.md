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
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT PK | 사용자 ID |
| email | VARCHAR(255) UNIQUE | 이메일 (로그인 ID) |
| password_hash | VARCHAR(255) | 암호화된 비밀번호 |
| nickname | VARCHAR(50) | 닉네임 |
| created_at | TIMESTAMP | 가입일시 |
| updated_at | TIMESTAMP | 수정일시 |

---

### Account (가상계좌) — User와 1:1
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT PK | 계좌 ID |
| user_id | BIGINT FK(User) UNIQUE | 사용자 ID |
| balance | BIGINT | 가용 잔고 (원 단위) |
| initial_balance | BIGINT | 초기 지급 자본금 (기본 10,000,000) |
| created_at | TIMESTAMP | 계좌 생성일시 |
| updated_at | TIMESTAMP | 수정일시 |

---

### Stock (종목)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT PK | 종목 ID |
| code | VARCHAR(20) UNIQUE | 종목 코드 (ex. 005930) |
| name | VARCHAR(100) | 종목명 (ex. 삼성전자) |
| market | VARCHAR(20) | 시장 구분 (KOSPI / KOSDAQ) |
| sector | VARCHAR(100) | 업종 |
| created_at | TIMESTAMP | 등록일시 |

---

### News (뉴스)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT PK | 뉴스 ID |
| stock_id | BIGINT FK(Stock) | 관련 종목 ID |
| title | VARCHAR(500) | 뉴스 제목 |
| summary | TEXT | 뉴스 요약 |
| url | VARCHAR(1000) | 원문 URL |
| source | VARCHAR(100) | 출처 매체 (ex. 연합뉴스) |
| published_at | TIMESTAMP | 뉴스 발행일시 |
| collected_at | TIMESTAMP | 수집일시 |

---

### AiAnalysis (AI 분석 결과)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT PK | 분석 ID |
| stock_id | BIGINT FK(Stock) | 분석 대상 종목 ID |
| gemini_result | TEXT | Gemini 분석 내용 |
| claude_result | TEXT | Claude 분석 내용 |
| gemini_recommendation | VARCHAR(20) | Gemini 추천 (BUY / HOLD / SELL) |
| claude_recommendation | VARCHAR(20) | Claude 추천 (BUY / HOLD / SELL) |
| is_matched | BOOLEAN | 두 AI 결과 일치 여부 |
| sentiment | VARCHAR(20) | 투자심리 (POSITIVE / NEUTRAL / NEGATIVE) |
| price_at_analysis | BIGINT | 분석 시점 주가 |
| analyzed_at | TIMESTAMP | 분석 실행일시 |

---

### AiAnalysisNews (AI분석-뉴스 중간 테이블)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| ai_analysis_id | BIGINT FK(AiAnalysis) | 분석 ID |
| news_id | BIGINT FK(News) | 뉴스 ID |
| PRIMARY KEY | (ai_analysis_id, news_id) | 복합키 |

---

### Order (주문 내역)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT PK | 주문 ID |
| user_id | BIGINT FK(User) | 사용자 ID |
| account_id | BIGINT FK(Account) | 계좌 ID |
| stock_id | BIGINT FK(Stock) | 종목 ID |
| ai_analysis_id | BIGINT FK(AiAnalysis) NULL | 매매 당시 AI 분석 ID (복기용) |
| order_type | VARCHAR(10) | 주문 유형 (BUY / SELL) |
| quantity | INT | 주문 수량 |
| price | BIGINT | 체결 가격 (원 단위) |
| total_amount | BIGINT | 총 거래금액 (quantity * price) |
| ordered_at | TIMESTAMP | 주문 체결일시 |

---

### Holding (보유 종목)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT PK | 보유 ID |
| user_id | BIGINT FK(User) | 사용자 ID |
| stock_id | BIGINT FK(Stock) | 종목 ID |
| quantity | INT | 보유 수량 |
| avg_price | BIGINT | 평균 매수가 |
| updated_at | TIMESTAMP | 최근 수정일시 |
| UNIQUE | (user_id, stock_id) | 사용자당 종목 1행 유지 |

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

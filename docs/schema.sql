-- 모이고 DB 스키마
-- PostgreSQL 기준

-- updated_at 자동 갱신 트리거 함수
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. users (사용자)
CREATE TABLE users (
    id              BIGSERIAL       PRIMARY KEY,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NULL,
    nickname        VARCHAR(50)     NOT NULL,
    login_type          VARCHAR(20)     NOT NULL DEFAULT 'LOCAL',
    social_id           VARCHAR(255)    NULL,
    marketing_agreed    BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_login_type CHECK (login_type IN ('LOCAL', 'GOOGLE')),
    CONSTRAINT chk_local_password CHECK (
        (login_type = 'LOCAL' AND password_hash IS NOT NULL) OR
        (login_type = 'GOOGLE' AND social_id IS NOT NULL)
    )
);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. accounts (가상계좌) — users와 1:1
CREATE TABLE accounts (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance         BIGINT          NOT NULL DEFAULT 10000000,
    initial_balance BIGINT          NOT NULL DEFAULT 10000000,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_balance_non_negative CHECK (balance >= 0)
);

CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. stocks (종목)
CREATE TABLE stocks (
    id          BIGSERIAL       PRIMARY KEY,
    code        VARCHAR(20)     NOT NULL UNIQUE,
    name        VARCHAR(100)    NOT NULL,
    market      VARCHAR(20)     NOT NULL DEFAULT 'KOSPI',
    sector      VARCHAR(100)    NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_market CHECK (market IN ('KOSPI', 'KOSDAQ'))
);

-- 4. news (뉴스)
CREATE TABLE news (
    id              BIGSERIAL       PRIMARY KEY,
    stock_id        BIGINT          NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    title           VARCHAR(500)    NOT NULL,
    summary         TEXT            NULL,
    url             VARCHAR(1000)   NOT NULL,
    source          VARCHAR(100)    NULL,  -- 네이버 뉴스 API 응답에 언론사 필드가 없어 NULL 허용
    published_at    TIMESTAMPTZ     NOT NULL,
    collected_at    TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. ai_analyses (AI 분석 결과)
CREATE TABLE ai_analyses (
    id                      BIGSERIAL       PRIMARY KEY,
    stock_id                BIGINT          NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    gemini_result           TEXT            NULL,
    claude_result           TEXT            NULL,
    clova_result            TEXT            NULL,
    gemini_recommendation   VARCHAR(20)     NULL,
    claude_recommendation   VARCHAR(20)     NULL,
    clova_recommendation    VARCHAR(20)     NULL,
    is_matched              BOOLEAN         NULL,
    sentiment               VARCHAR(20)     NULL,
    price_at_analysis       BIGINT          NULL,
    analyzed_at             TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_gemini_recommendation CHECK (gemini_recommendation IN ('BUY', 'HOLD', 'SELL')),
    CONSTRAINT chk_claude_recommendation CHECK (claude_recommendation IN ('BUY', 'HOLD', 'SELL')),
    CONSTRAINT chk_clova_recommendation CHECK (clova_recommendation IN ('BUY', 'HOLD', 'SELL')),
    CONSTRAINT chk_sentiment CHECK (sentiment IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE'))
);

-- 6. ai_analysis_news (AI분석-뉴스 중간 테이블)
CREATE TABLE ai_analysis_news (
    ai_analysis_id  BIGINT  NOT NULL REFERENCES ai_analyses(id) ON DELETE CASCADE,
    news_id         BIGINT  NOT NULL REFERENCES news(id) ON DELETE CASCADE,

    PRIMARY KEY (ai_analysis_id, news_id)
);

-- 7. orders (주문 내역)
CREATE TABLE orders (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id      BIGINT          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    stock_id        BIGINT          NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    ai_analysis_id  BIGINT          NULL REFERENCES ai_analyses(id) ON DELETE SET NULL,
    order_type      VARCHAR(10)     NOT NULL,
    price_type      VARCHAR(10)     NOT NULL DEFAULT 'MARKET',
    status          VARCHAR(10)     NOT NULL DEFAULT 'FILLED',
    quantity        INT             NOT NULL CHECK (quantity > 0),
    limit_price     BIGINT          NULL,       -- 지정가 주문의 지정가
    -- 체결된 주문은 평균 체결가(반올림)와 실제 체결 금액, 미체결 주문은 지정가와 지정가 기준 금액
    price           BIGINT          NOT NULL CHECK (price > 0),
    total_amount    BIGINT          NOT NULL CHECK (total_amount > 0),
    ordered_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    filled_at       TIMESTAMPTZ     NULL,

    CONSTRAINT chk_order_type CHECK (order_type IN ('BUY', 'SELL')),
    CONSTRAINT chk_price_type CHECK (price_type IN ('MARKET', 'LIMIT')),
    CONSTRAINT chk_order_status CHECK (status IN ('PENDING', 'FILLED', 'CANCELLED', 'EXPIRED')),
    CONSTRAINT chk_limit_price CHECK (limit_price IS NULL OR limit_price > 0)
);

-- 8. holdings (보유 종목)
CREATE TABLE holdings (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_id    BIGINT      NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    quantity    INT         NOT NULL CHECK (quantity > 0),
    avg_price   BIGINT      NOT NULL CHECK (avg_price > 0),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (user_id, stock_id)
);

CREATE TRIGGER trg_holdings_updated_at
    BEFORE UPDATE ON holdings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9. stock_price_cache (종목별 최신 시세 캐시) — 종목당 1행, 매 조회 시 덮어씀
-- 과거 이력은 저장하지 않음: 캔들 API로 언제든 재조회 가능해 중복 저장 실익이 없음
-- (market_rank만 예외지만, 지금 단계에선 히스토리로 남길 필요성이 낮아 함께 생략)
CREATE TABLE stock_price_cache (
    id              BIGSERIAL       PRIMARY KEY,
    stock_id        BIGINT          NOT NULL UNIQUE REFERENCES stocks(id) ON DELETE CASCADE,
    current_price   BIGINT          NOT NULL CHECK (current_price > 0),
    change_rate     NUMERIC(10, 6)  NULL,
    trading_volume  BIGINT          NULL,
    trading_amount  BIGINT          NULL,
    market_rank     INT             NULL,
    fetched_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_stock_price_cache_updated_at
    BEFORE UPDATE ON stock_price_cache
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 10. stock_daily_candles (종목별 일봉) — 종목·거래일당 1행
-- 토스 캔들 API는 일봉까지만 주고 한 번에 200개로 제한돼서, 주/월/년봉 차트를 만들려면 일봉을
-- 수백~천 개 읽어야 한다. 매번 다시 받지 않도록 한 번 받은 일봉을 저장하고 이후엔 최근 봉만 갱신한다.
CREATE TABLE stock_daily_candles (
    id              BIGSERIAL       PRIMARY KEY,
    stock_id        BIGINT          NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    trade_date      DATE            NOT NULL,
    open_price      BIGINT          NOT NULL CHECK (open_price >= 0),
    high_price      BIGINT          NOT NULL CHECK (high_price >= 0),
    low_price       BIGINT          NOT NULL CHECK (low_price >= 0),
    close_price     BIGINT          NOT NULL CHECK (close_price >= 0),
    volume          BIGINT          NOT NULL CHECK (volume >= 0),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (stock_id, trade_date)
);

CREATE TRIGGER trg_stock_daily_candles_updated_at
    BEFORE UPDATE ON stock_daily_candles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 인덱스
CREATE INDEX idx_news_stock_id ON news(stock_id);
CREATE INDEX idx_orders_pending ON orders(stock_id) WHERE status = 'PENDING';
CREATE INDEX idx_news_published_at ON news(published_at);
CREATE INDEX idx_ai_analyses_stock_id ON ai_analyses(stock_id);
CREATE INDEX idx_ai_analyses_analyzed_at ON ai_analyses(analyzed_at);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_stock_id ON orders(stock_id);
CREATE INDEX idx_orders_ordered_at ON orders(ordered_at);
CREATE INDEX idx_holdings_user_id ON holdings(user_id);

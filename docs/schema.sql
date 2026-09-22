-- 모이고 DB 스키마
-- PostgreSQL 기준

-- 1. users (사용자)
CREATE TABLE users (
    id              BIGSERIAL       PRIMARY KEY,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NULL,
    nickname        VARCHAR(50)     NOT NULL,
    login_type          VARCHAR(20)     NOT NULL DEFAULT 'LOCAL',
    social_id           VARCHAR(255)    NULL,
    marketing_agreed    BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_login_type CHECK (login_type IN ('LOCAL', 'GOOGLE')),
    CONSTRAINT chk_local_password CHECK (
        (login_type = 'LOCAL' AND password_hash IS NOT NULL) OR
        (login_type = 'GOOGLE' AND social_id IS NOT NULL)
    )
);

-- 2. accounts (가상계좌) — users와 1:1
CREATE TABLE accounts (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance         BIGINT          NOT NULL DEFAULT 10000000,
    initial_balance BIGINT          NOT NULL DEFAULT 10000000,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. stocks (종목)
CREATE TABLE stocks (
    id          BIGSERIAL       PRIMARY KEY,
    code        VARCHAR(20)     NOT NULL UNIQUE,
    name        VARCHAR(100)    NOT NULL,
    market      VARCHAR(20)     NOT NULL DEFAULT 'KOSPI',
    sector      VARCHAR(100)    NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_market CHECK (market IN ('KOSPI', 'KOSDAQ'))
);

-- 4. news (뉴스)
CREATE TABLE news (
    id              BIGSERIAL       PRIMARY KEY,
    stock_id        BIGINT          NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    title           VARCHAR(500)    NOT NULL,
    summary         TEXT            NULL,
    url             VARCHAR(1000)   NOT NULL,
    source          VARCHAR(100)    NOT NULL,
    published_at    TIMESTAMP       NOT NULL,
    collected_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. ai_analyses (AI 분석 결과)
CREATE TABLE ai_analyses (
    id                      BIGSERIAL       PRIMARY KEY,
    stock_id                BIGINT          NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    gemini_result           TEXT            NULL,
    claude_result           TEXT            NULL,
    gemini_recommendation   VARCHAR(20)     NULL,
    claude_recommendation   VARCHAR(20)     NULL,
    is_matched              BOOLEAN         NULL,
    sentiment               VARCHAR(20)     NULL,
    price_at_analysis       BIGINT          NULL,
    analyzed_at             TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_gemini_recommendation CHECK (gemini_recommendation IN ('BUY', 'HOLD', 'SELL')),
    CONSTRAINT chk_claude_recommendation CHECK (claude_recommendation IN ('BUY', 'HOLD', 'SELL')),
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
    quantity        INT             NOT NULL CHECK (quantity > 0),
    price           BIGINT          NOT NULL CHECK (price > 0),
    total_amount    BIGINT          NOT NULL CHECK (total_amount > 0),
    ordered_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_order_type CHECK (order_type IN ('BUY', 'SELL'))
);

-- 8. holdings (보유 종목)
CREATE TABLE holdings (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_id    BIGINT      NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    quantity    INT         NOT NULL CHECK (quantity > 0),
    avg_price   BIGINT      NOT NULL CHECK (avg_price > 0),
    updated_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (user_id, stock_id)
);

-- 인덱스
CREATE INDEX idx_news_stock_id ON news(stock_id);
CREATE INDEX idx_news_published_at ON news(published_at);
CREATE INDEX idx_ai_analyses_stock_id ON ai_analyses(stock_id);
CREATE INDEX idx_ai_analyses_analyzed_at ON ai_analyses(analyzed_at);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_stock_id ON orders(stock_id);
CREATE INDEX idx_orders_ordered_at ON orders(ordered_at);
CREATE INDEX idx_holdings_user_id ON holdings(user_id);

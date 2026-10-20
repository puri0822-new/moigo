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
    price_alert_enabled BOOLEAN         NOT NULL DEFAULT TRUE,   -- 회원 설정의 급등락 알림 전체 스위치
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
    gemini_recommendation   VARCHAR(20)     NULL,
    claude_recommendation   VARCHAR(20)     NULL,
    is_matched              BOOLEAN         NULL,
    sentiment               VARCHAR(20)     NULL,
    price_at_analysis       BIGINT          NULL,
    analyzed_at             TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    ordered_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_order_type CHECK (order_type IN ('BUY', 'SELL')),
    CONSTRAINT chk_total_amount CHECK (total_amount = price * quantity)
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

-- 인덱스
CREATE INDEX idx_news_stock_id ON news(stock_id);
CREATE INDEX idx_news_published_at ON news(published_at);
CREATE INDEX idx_ai_analyses_stock_id ON ai_analyses(stock_id);
CREATE INDEX idx_ai_analyses_analyzed_at ON ai_analyses(analyzed_at);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_stock_id ON orders(stock_id);
CREATE INDEX idx_orders_ordered_at ON orders(ordered_at);
CREATE INDEX idx_holdings_user_id ON holdings(user_id);

-- posts / post_likes / post_comments (커뮤니티 피드: 글, 좋아요, 댓글)
CREATE TABLE posts (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_id    BIGINT       NULL REFERENCES stocks(id) ON DELETE SET NULL,   -- 특정 종목에 대한 글이면 그 종목, 자유 글이면 NULL
    content     TEXT         NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
    image_url   VARCHAR(255) NULL,   -- 붙인 사진의 서버 경로(/uploads/posts/...), 없으면 NULL
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_likes (
    id          BIGSERIAL    PRIMARY KEY,
    post_id     BIGINT       NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (post_id, user_id)
);

CREATE TABLE post_comments (
    id          BIGSERIAL    PRIMARY KEY,
    post_id     BIGINT       NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT         NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_posts_stock_id ON posts(stock_id);
CREATE INDEX idx_post_comments_post_id ON post_comments(post_id);

-- watchlist / notifications (관심 종목, 급등락 알림)
CREATE TABLE watchlist (
    id             BIGSERIAL    PRIMARY KEY,
    user_id        BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_id       BIGINT       NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    alert_enabled  BOOLEAN      NOT NULL DEFAULT FALSE,   -- 이 종목의 급등락 알림을 받을지
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (user_id, stock_id)
);

CREATE TABLE notifications (
    id           BIGSERIAL     PRIMARY KEY,
    user_id      BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_id     BIGINT        NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    direction    VARCHAR(4)    NOT NULL CHECK (direction IN ('UP', 'DOWN')),
    level        INT           NOT NULL,                 -- 넘은 단계(5, 10, 15...). 같은 날 같은 단계는 한 번만 알린다
    change_rate  NUMERIC(6,2)  NOT NULL,                 -- 알림을 만든 순간의 전일 대비 등락률(%)
    price        BIGINT        NOT NULL,
    trade_date   DATE          NOT NULL,
    read_at      TIMESTAMPTZ   NULL,
    deleted_at   TIMESTAMPTZ   NULL,                     -- 사용자가 지운 알림. 행을 남겨야 같은 날 같은 단계 알림이 다시 생기지 않는다
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (user_id, stock_id, trade_date, direction, level)
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id, created_at DESC);

-- ai_models / ai_recommendations / ai_recommendation_results / ai_recommendation_evidence (AI 모델, 종목 추천, 결과 검증, 근거 뉴스)
-- 추천을 내는 AI 모델 목록. 모델을 추가·중단할 때 코드를 고치지 않고 이 테이블만 바꾼다
CREATE TABLE ai_models (
    code          VARCHAR(30)   PRIMARY KEY,                        -- CLAUDE, GEMINI, ... (ai_recommendations.ai_model이 참조)
    display_name  VARCHAR(50)   NOT NULL,                           -- 화면에 보이는 이름
    provider      VARCHAR(30)   NOT NULL,                           -- ANTHROPIC, GOOGLE, ...
    model_id      VARCHAR(100)  NULL,                               -- API 호출에 쓰는 모델 ID. 추천 생성을 붙일 때 채운다
    color         VARCHAR(7)    NOT NULL,                           -- 그래프·강조에 쓰는 색 (#RRGGBB)
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,              -- FALSE면 새 추천을 만들지 않는다 (지난 성적은 남는다)
    sort_order    INT           NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_ai_models_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

INSERT INTO ai_models (code, display_name, provider, color, sort_order) VALUES
    ('CLAUDE', 'Claude', 'ANTHROPIC', '#D4714F', 1),
    ('GEMINI', 'Gemini', 'GOOGLE', '#4285F4', 2),
    ('CLOVA', 'CLOVA', 'NAVER', '#03C75A', 3);

CREATE TABLE ai_recommendations (
    id                       BIGSERIAL     PRIMARY KEY,
    ai_model                 VARCHAR(30)   NOT NULL REFERENCES ai_models(code),  -- 추천한 AI
    period_type              VARCHAR(10)   NOT NULL,                     -- WEEKLY: 1주 뒤 검증, MONTHLY: 1달 뒤 검증
    stock_id                 BIGINT        NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    opinion                  VARCHAR(10)   NOT NULL,                     -- BUY: 오르면 적중, SELL: 떨어지면 적중
    reason                   TEXT          NOT NULL,                     -- AI가 밝힌 추천 근거
    summary                  VARCHAR(100)  NULL,                          -- 대시보드용 25자 안팎 한 줄 요약
    confidence               SMALLINT      NULL CHECK (confidence BETWEEN 0 AND 100),
    price_at_recommendation  BIGINT        NOT NULL CHECK (price_at_recommendation > 0),
    recommended_at           TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    evaluate_at              TIMESTAMPTZ   NOT NULL,                     -- 이 시각이 지나면 결과를 검증한다

    CONSTRAINT chk_ai_rec_period CHECK (period_type IN ('WEEKLY', 'MONTHLY')),
    CONSTRAINT chk_ai_rec_opinion CHECK (opinion IN ('BUY', 'SELL'))
);

CREATE TABLE ai_recommendation_results (
    id                   BIGSERIAL      PRIMARY KEY,
    recommendation_id    BIGINT         NOT NULL UNIQUE REFERENCES ai_recommendations(id) ON DELETE CASCADE,
    price_at_evaluation  BIGINT         NOT NULL CHECK (price_at_evaluation > 0),
    return_rate          NUMERIC(8, 4)  NOT NULL,                        -- (검증가 - 추천가) / 추천가, 0.0123 = +1.23%
    is_hit               BOOLEAN        NOT NULL,
    failure_reason       TEXT           NULL,                            -- 틀렸을 때 AI가 뉴스를 근거로 설명한 이유
    evaluated_at         TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_recommendation_evidence (
    id                 BIGSERIAL     PRIMARY KEY,
    recommendation_id  BIGINT        NOT NULL REFERENCES ai_recommendations(id) ON DELETE CASCADE,
    title              VARCHAR(500)  NOT NULL,                          -- 근거로 쓴 뉴스 제목
    source             VARCHAR(100)  NULL,                              -- 언론사
    url                VARCHAR(1000) NULL,
    published_at       TIMESTAMPTZ   NULL,
    insight            TEXT          NOT NULL                           -- 이 뉴스가 추천에 어떻게 반영됐는지 AI가 쓴 한 줄
);

CREATE INDEX idx_ai_rec_model_period ON ai_recommendations(ai_model, period_type, recommended_at DESC);
CREATE INDEX idx_ai_rec_stock_id ON ai_recommendations(stock_id);
CREATE INDEX idx_ai_rec_evaluate_at ON ai_recommendations(evaluate_at);
CREATE INDEX idx_ai_rec_evidence_rec_id ON ai_recommendation_evidence(recommendation_id);

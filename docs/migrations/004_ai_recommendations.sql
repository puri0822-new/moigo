-- AI 모델 목록, AI 종목 추천과 그 결과 검증. 이미 만들어진 DB에 한 번 실행한다 (여러 번 실행해도 안전). 새로 만드는 DB는 schema.sql만 실행하면 된다.
-- 추천을 만들 때 ai_recommendations에 한 줄을, 근거로 쓴 뉴스는 ai_recommendation_evidence에 넣고, evaluate_at이 지나면 그 시점 가격으로 ai_recommendation_results를 채운다.

-- 추천을 내는 AI 모델 목록. 모델을 추가·중단할 때 코드를 고치지 않고 이 테이블만 바꾼다
CREATE TABLE IF NOT EXISTS ai_models (
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
    ('GEMINI', 'Gemini', 'GOOGLE', '#4285F4', 2)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ai_recommendations (
    id                       BIGSERIAL     PRIMARY KEY,
    ai_model                 VARCHAR(30)   NOT NULL REFERENCES ai_models(code),  -- 추천한 AI
    period_type              VARCHAR(10)   NOT NULL,                     -- WEEKLY: 1주 뒤 검증, MONTHLY: 1달 뒤 검증
    stock_id                 BIGINT        NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    opinion                  VARCHAR(10)   NOT NULL,                     -- BUY: 오르면 적중, SELL: 떨어지면 적중
    reason                   TEXT          NOT NULL,                     -- AI가 밝힌 추천 근거
    confidence               SMALLINT      NULL CHECK (confidence BETWEEN 0 AND 100),
    price_at_recommendation  BIGINT        NOT NULL CHECK (price_at_recommendation > 0),
    recommended_at           TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    evaluate_at              TIMESTAMPTZ   NOT NULL,                     -- 이 시각이 지나면 결과를 검증한다

    CONSTRAINT chk_ai_rec_period CHECK (period_type IN ('WEEKLY', 'MONTHLY')),
    CONSTRAINT chk_ai_rec_opinion CHECK (opinion IN ('BUY', 'SELL'))
);

CREATE TABLE IF NOT EXISTS ai_recommendation_results (
    id                   BIGSERIAL      PRIMARY KEY,
    recommendation_id    BIGINT         NOT NULL UNIQUE REFERENCES ai_recommendations(id) ON DELETE CASCADE,
    price_at_evaluation  BIGINT         NOT NULL CHECK (price_at_evaluation > 0),
    return_rate          NUMERIC(8, 4)  NOT NULL,                        -- (검증가 - 추천가) / 추천가, 0.0123 = +1.23%
    is_hit               BOOLEAN        NOT NULL,
    failure_reason       TEXT           NULL,                            -- 틀렸을 때 AI가 뉴스를 근거로 설명한 이유
    evaluated_at         TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_recommendation_evidence (
    id                 BIGSERIAL     PRIMARY KEY,
    recommendation_id  BIGINT        NOT NULL REFERENCES ai_recommendations(id) ON DELETE CASCADE,
    title              VARCHAR(500)  NOT NULL,                          -- 근거로 쓴 뉴스 제목
    source             VARCHAR(100)  NULL,                              -- 언론사
    url                VARCHAR(1000) NULL,
    published_at       TIMESTAMPTZ   NULL,
    insight            TEXT          NOT NULL                           -- 이 뉴스가 추천에 어떻게 반영됐는지 AI가 쓴 한 줄
);

CREATE INDEX IF NOT EXISTS idx_ai_rec_model_period ON ai_recommendations(ai_model, period_type, recommended_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_rec_stock_id ON ai_recommendations(stock_id);
CREATE INDEX IF NOT EXISTS idx_ai_rec_evaluate_at ON ai_recommendations(evaluate_at);
CREATE INDEX IF NOT EXISTS idx_ai_rec_evidence_rec_id ON ai_recommendation_evidence(recommendation_id);

-- ai_models가 생기기 전에 이 파일을 실행한 DB는 ai_recommendations에 외래 키가 없으므로 붙여 준다
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ai_recommendations_ai_model_fkey'
    ) THEN
        ALTER TABLE ai_recommendations
            ADD CONSTRAINT ai_recommendations_ai_model_fkey FOREIGN KEY (ai_model) REFERENCES ai_models(code);
    END IF;
END $$;

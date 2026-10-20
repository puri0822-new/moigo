-- 종목 상세 "AI 인사이트 > 등락 이유". 이미 만들어진 DB에 한 번 실행한다 (여러 번 실행해도 안전).
-- 상세 페이지를 열 때 그 거래일 이유가 없거나, 장중인데 만든 지 1시간이 지났으면 AI가 새로 쓴다. 종목·거래일마다 한 줄만 둔다.

CREATE TABLE IF NOT EXISTS stock_ai_reasons (
    id           BIGSERIAL     PRIMARY KEY,
    stock_id     BIGINT        NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    trade_date   DATE          NOT NULL,                 -- 등락률을 계산한 거래일
    ai_model     VARCHAR(30)   NOT NULL REFERENCES ai_models(code),
    change_rate  NUMERIC(6,2)  NOT NULL,                 -- 이유를 쓸 때의 전일 대비 등락률(%)
    reason       TEXT          NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (stock_id, trade_date)
);

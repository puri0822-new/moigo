-- CLOVA Studio 분석 결과 컬럼 추가. 이미 있는 DB에 한 번 실행 (여러 번 실행해도 안전).

ALTER TABLE ai_analyses
    ADD COLUMN IF NOT EXISTS clova_result TEXT NULL,
    ADD COLUMN IF NOT EXISTS clova_recommendation VARCHAR(20) NULL;

ALTER TABLE ai_analyses DROP CONSTRAINT IF EXISTS chk_clova_recommendation;
ALTER TABLE ai_analyses ADD CONSTRAINT chk_clova_recommendation
    CHECK (clova_recommendation IS NULL OR clova_recommendation IN ('BUY', 'HOLD', 'SELL'));

-- AI 분석의 Claude 자리를 GPT(GitHub Models)로 바꾼다. 이미 있는 DB에 한 번 실행 (여러 번 실행해도 안전).
-- 기존 claude_* 값은 gpt_* 컬럼으로 그대로 옮겨진다. 새로 만드는 DB는 schema.sql만 실행하면 된다.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_analyses' AND column_name = 'claude_result'
    ) THEN
        ALTER TABLE ai_analyses RENAME COLUMN claude_result TO gpt_result;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_analyses' AND column_name = 'claude_recommendation'
    ) THEN
        ALTER TABLE ai_analyses RENAME COLUMN claude_recommendation TO gpt_recommendation;
    END IF;
END $$;

ALTER TABLE ai_analyses DROP CONSTRAINT IF EXISTS chk_claude_recommendation;
ALTER TABLE ai_analyses DROP CONSTRAINT IF EXISTS chk_gpt_recommendation;
ALTER TABLE ai_analyses ADD CONSTRAINT chk_gpt_recommendation
    CHECK (gpt_recommendation IN ('BUY', 'HOLD', 'SELL'));

-- AI 추천 모델 목록도 CLAUDE → GPT. ai_recommendations가 code를 참조하므로 새 행을 넣고 옮긴 뒤 지운다
INSERT INTO ai_models (code, display_name, provider, color, sort_order) VALUES
    ('GPT', 'GPT', 'OPENAI', '#10A37F', 1)
ON CONFLICT (code) DO NOTHING;

UPDATE ai_recommendations SET ai_model = 'GPT' WHERE ai_model = 'CLAUDE';
DELETE FROM ai_models WHERE code = 'CLAUDE';

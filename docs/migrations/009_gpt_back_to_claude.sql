-- backend_C에서 잠시 쓰던 "Claude → GPT" 변경(지운 005_claude_to_gpt.sql)을 되돌려 다시 Claude로 맞춘다.
-- 그 파일을 실행한 DB에만 바뀌는 것이 있고, 실행한 적 없는 DB에서는 아무것도 하지 않는다 (여러 번 실행해도 안전).

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_analyses' AND column_name = 'gpt_result'
    ) THEN
        ALTER TABLE ai_analyses RENAME COLUMN gpt_result TO claude_result;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_analyses' AND column_name = 'gpt_recommendation'
    ) THEN
        ALTER TABLE ai_analyses RENAME COLUMN gpt_recommendation TO claude_recommendation;
    END IF;
END $$;

ALTER TABLE ai_analyses DROP CONSTRAINT IF EXISTS chk_gpt_recommendation;
ALTER TABLE ai_analyses DROP CONSTRAINT IF EXISTS chk_claude_recommendation;
ALTER TABLE ai_analyses ADD CONSTRAINT chk_claude_recommendation
    CHECK (claude_recommendation IN ('BUY', 'HOLD', 'SELL'));

-- AI 모델 목록도 GPT → CLAUDE. ai_recommendations·stock_ai_reasons가 code를 참조하므로 새 행을 넣고 옮긴 뒤 지운다
INSERT INTO ai_models (code, display_name, provider, color, sort_order) VALUES
    ('CLAUDE', 'Claude', 'ANTHROPIC', '#D4714F', 1)
ON CONFLICT (code) DO NOTHING;

UPDATE ai_recommendations SET ai_model = 'CLAUDE' WHERE ai_model = 'GPT';

DO $$
BEGIN
    -- 007_stock_ai_reasons.sql을 아직 실행하지 않은 DB에는 이 테이블이 없다
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_ai_reasons') THEN
        UPDATE stock_ai_reasons SET ai_model = 'CLAUDE' WHERE ai_model = 'GPT';
    END IF;
END $$;

DELETE FROM ai_models WHERE code = 'GPT';

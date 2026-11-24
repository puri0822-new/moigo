-- AI 추천을 시장 지수 대비 초과수익으로 채점한다. 이미 만들어진 DB에 한 번 실행한다 (여러 번 실행해도 안전).
-- 실행 뒤 backend 폴더에서 `venv/bin/python -m app.jobs.ai_jobs rescore`로 지난 추천을 새 기준으로 다시 채점한다.

-- 추천할 때 그 종목 시장(코스피·코스닥) 지수
ALTER TABLE ai_recommendations ADD COLUMN IF NOT EXISTS benchmark_at_recommendation NUMERIC(10, 2) NULL;

-- 같은 기간 시장 지수 수익률 (0.0123 = +1.23%)
ALTER TABLE ai_recommendation_results ADD COLUMN IF NOT EXISTS benchmark_return_rate NUMERIC(8, 4) NULL;

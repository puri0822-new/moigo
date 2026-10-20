-- AI 추천 모델에 CLOVA(네이버 HyperCLOVA X)를 추가하고, 추천에 짧은 한 줄 요약 칸을 붙인다. 이미 만들어진 DB에 한 번 실행한다 (여러 번 실행해도 안전).
-- 어떤 모델이 실제로 추천을 만드는지는 backend/.env의 API 키로 정해진다 (키가 없는 모델은 화면에서도 숨긴다).

INSERT INTO ai_models (code, display_name, provider, color, sort_order) VALUES
    ('CLOVA', 'CLOVA', 'NAVER', '#03C75A', 3)
ON CONFLICT (code) DO NOTHING;

-- 대시보드 종목명 옆에 보여줄 25자 안팎의 핵심 요약. 긴 이유는 reason에 있다
ALTER TABLE ai_recommendations ADD COLUMN IF NOT EXISTS summary VARCHAR(100) NULL;

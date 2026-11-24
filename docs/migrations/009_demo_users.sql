-- 체험용 사용자 표시. 전시 때 랭킹·피드를 채우려고 넣은 체험 계정은 화면에서 닉네임 옆에 "체험"을 붙인다.
-- 이미 만들어진 DB에 한 번 실행한다 (여러 번 실행해도 안전).

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

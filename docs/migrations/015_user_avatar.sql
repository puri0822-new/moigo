-- 프로필 사진 경로. 여러 번 실행해도 안전.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255) NULL;

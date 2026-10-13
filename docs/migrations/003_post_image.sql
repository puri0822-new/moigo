-- 피드 글에 사진 1장을 붙일 수 있게 한다. 이미 만들어진 DB에 한 번 실행한다 (여러 번 실행해도 안전).
-- 값은 서버가 저장한 파일의 경로(/uploads/posts/...)이고, 사진이 없는 글은 NULL.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url VARCHAR(255) NULL;

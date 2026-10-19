from pathlib import Path

# 업로드 파일은 backend/uploads 아래에 저장하고 /uploads 경로로 그대로 제공한다
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_URL_PREFIX = "/uploads"

POST_IMAGE_DIR = UPLOAD_DIR / "posts"
POST_IMAGE_URL_PREFIX = f"{UPLOAD_URL_PREFIX}/posts"

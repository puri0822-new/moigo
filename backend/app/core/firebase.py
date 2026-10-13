from pathlib import Path

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from app.core.config import settings

_BACKEND_DIR = Path(__file__).resolve().parents[2]

_initialized = False

def get_firebase_app():
    global _initialized
    if not _initialized:
        # 상대 경로는 실행 위치와 무관하게 backend/ 기준으로 해석
        path = Path(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
        if not path.is_absolute():
            path = _BACKEND_DIR / path
        cred = credentials.Certificate(str(path))
        firebase_admin.initialize_app(cred)
        _initialized = True
    return firebase_admin.get_app()

def verify_google_token(id_token: str) -> dict:
    get_firebase_app()
    decoded = firebase_auth.verify_id_token(id_token)
    return decoded

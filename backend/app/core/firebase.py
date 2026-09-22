import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from app.core.config import FIREBASE_SERVICE_ACCOUNT_PATH

_initialized = False

def get_firebase_app():
    global _initialized
    if not _initialized:
        cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
        _initialized = True
    return firebase_admin.get_app()

def verify_google_token(id_token: str) -> dict:
    get_firebase_app()
    decoded = firebase_auth.verify_id_token(id_token)
    return decoded

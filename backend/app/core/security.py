from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings

PASSWORD_MIN = 8
PASSWORD_MAX = 64
# bcrypt는 앞 72바이트만 쓴다. 예전 passlib도 그대로 넘겨 bcrypt가 잘랐으므로, 같은 방식으로 잘라야 기존 해시와 맞는다
_BCRYPT_MAX_BYTES = 72


def _encode(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_encode(password), bcrypt.gensalt()).decode("ascii")


def verify_password(plain_password: str, password_hash: str | None) -> bool:
    # 구글로 가입한 계정은 비밀번호가 없다
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(_encode(plain_password), password_hash.encode("ascii"))
    except ValueError:
        return False


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM], options={"require": ["sub", "exp"]}
        )
    except jwt.PyJWTError:
        return None

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.account import Account
from app.schemas.auth import SignupRequest, LoginRequest, TokenResponse, UserResponse
from app.core.security import hash_password, verify_password, create_access_token
from app.core.firebase import verify_google_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/signup", status_code=201)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="이미 사용 중인 이메일입니다")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        nickname=body.nickname,
        login_type="LOCAL",
        marketing_agreed=body.marketing_agreed,
    )
    db.add(user)
    db.flush()

    account = Account(user_id=user.id)
    db.add(account)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "data": {"user_id": user.id, "email": user.email, "nickname": user.nickname},
        "message": "회원가입 성공"
    }

@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")

    token = create_access_token({"sub": str(user.id)})
    return {
        "success": True,
        "data": {"access_token": token, "token_type": "bearer", "nickname": user.nickname},
        "message": "로그인 성공"
    }

@router.post("/logout")
def logout():
    return {"success": True, "data": None, "message": "로그아웃 성공"}


class GoogleLoginRequest(BaseModel):
    google_token: str


@router.post("/google")
def google_login(body: GoogleLoginRequest, db: Session = Depends(get_db)):
    try:
        decoded = verify_google_token(body.google_token)
    except Exception:
        raise HTTPException(status_code=401, detail="유효하지 않은 Google 토큰입니다")

    social_id = decoded["uid"]
    email = decoded.get("email", "")
    name = decoded.get("name", "") or email.split("@")[0]

    user = db.query(User).filter(User.social_id == social_id).first()

    if not user:
        # 같은 이메일로 LOCAL 계정이 있으면 연결
        user = db.query(User).filter(User.email == email, User.login_type == "LOCAL").first()

    if not user:
        user = User(
            email=email,
            nickname=name,
            login_type="GOOGLE",
            social_id=social_id,
            password_hash=None,
            marketing_agreed=False,
        )
        db.add(user)
        db.flush()
        account = Account(user_id=user.id)
        db.add(account)
        db.commit()
        db.refresh(user)
    else:
        if not user.social_id:
            user.social_id = social_id
            db.commit()

    token = create_access_token({"sub": str(user.id)})
    return {
        "success": True,
        "data": {"access_token": token, "token_type": "bearer", "nickname": user.nickname},
        "message": "로그인 성공"
    }

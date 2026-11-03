from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.account import Account
from app.schemas.auth import SignupRequest, LoginRequest, TokenResponseData, SignupResponseData
from app.core.security import PASSWORD_MAX, PASSWORD_MIN, hash_password, verify_password, create_access_token
from app.core.firebase import verify_google_token

router = APIRouter(prefix="/auth", tags=["auth"])

NICKNAME_MAX = 50  # users.nickname VARCHAR(50)


@router.post("/signup", status_code=201)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    if not PASSWORD_MIN <= len(body.password) <= PASSWORD_MAX:
        raise HTTPException(status_code=400, detail=f"비밀번호는 {PASSWORD_MIN}~{PASSWORD_MAX}자로 입력해 주세요")
    nickname = body.nickname.strip()
    if not nickname:
        raise HTTPException(status_code=400, detail="닉네임을 입력해 주세요")
    if len(nickname) > NICKNAME_MAX:
        raise HTTPException(status_code=400, detail=f"닉네임은 {NICKNAME_MAX}자 이하여야 합니다")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="이미 사용 중인 이메일입니다")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        nickname=nickname,
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

    token = create_access_token(str(user.id))
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
    name = (decoded.get("name", "") or email.split("@")[0])[:NICKNAME_MAX]

    user = db.query(User).filter(User.social_id == social_id).first()

    if not user and email:
        # 같은 이메일로 LOCAL 계정이 있으면 연결한다. 구글이 인증한 이메일일 때만 연결해야
        # 남의 이메일로 만든 구글(Firebase) 계정으로 기존 계정에 들어오는 일을 막을 수 있다
        local = db.query(User).filter(User.email == email, User.login_type == "LOCAL").first()
        if local:
            if not decoded.get("email_verified"):
                raise HTTPException(status_code=409, detail="이미 이메일로 가입된 계정입니다. 이메일과 비밀번호로 로그인해 주세요")
            user = local

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

    token = create_access_token(str(user.id))
    return {
        "success": True,
        "data": {"access_token": token, "token_type": "bearer", "nickname": user.nickname},
        "message": "로그인 성공"
    }

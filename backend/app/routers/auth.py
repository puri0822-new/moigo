from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.account import Account
from app.schemas.auth import SignupRequest, LoginRequest, TokenResponse, UserResponse
from app.core.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/signup", response_model=UserResponse, status_code=201)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="이미 사용 중인 이메일입니다")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        nickname=body.nickname,
        login_type="LOCAL",
    )
    db.add(user)
    db.flush()

    # 회원가입 시 가상계좌 자동 생성
    account = Account(user_id=user.id)
    db.add(account)
    db.commit()
    db.refresh(user)

    return UserResponse(user_id=user.id, email=user.email, nickname=user.nickname)

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)

@router.post("/logout")
def logout():
    return {"success": True, "data": None, "message": "로그아웃 성공"}

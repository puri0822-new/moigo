from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Account, User
from app.schemas.auth import LoginRequest, SignupRequest, SignupResponseData, TokenResponseData
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/signup", response_model=ApiResponse[SignupResponseData], status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        nickname=body.nickname,
        login_type="LOCAL",
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="이미 사용 중인 이메일입니다")

    db.add(Account(user_id=user.id))
    await db.commit()

    return ApiResponse(
        success=True,
        data=SignupResponseData(user_id=user.id, email=user.email, nickname=user.nickname),
        message="회원가입 성공",
    )


@router.post("/login", response_model=ApiResponse[TokenResponseData])
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")

    token = create_access_token(subject=str(user.id))
    return ApiResponse(success=True, data=TokenResponseData(access_token=token), message="로그인 성공")

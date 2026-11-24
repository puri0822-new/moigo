from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.security import hash_password, verify_password
from app.core.uploads import AVATAR_DIR, AVATAR_URL_PREFIX
from app.database import get_db
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.user import MyProfile, PasswordChangeRequest, ProfileUpdateRequest, WithdrawRequest

router = APIRouter(prefix="/users", tags=["Users"])

NICKNAME_MAX = 50
PASSWORD_MIN = 8
AVATAR_MAX_BYTES = 2 * 1024 * 1024


def _profile(user: User) -> MyProfile:
    return MyProfile(
        email=user.email,
        nickname=user.nickname,
        avatar_url=user.avatar_url,
        login_type=user.login_type,
        has_password=user.password_hash is not None,
        marketing_agreed=user.marketing_agreed,
        price_alert_enabled=user.price_alert_enabled,
        created_at=user.created_at,
    )


def _image_extension(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _avatar_file(avatar_url: str | None):
    if not avatar_url or not avatar_url.startswith(f"{AVATAR_URL_PREFIX}/"):
        return None
    return AVATAR_DIR / avatar_url.rsplit("/", 1)[-1]


def _delete_avatar_file(avatar_url: str | None) -> None:
    path = _avatar_file(avatar_url)
    if path and path.is_file():
        path.unlink(missing_ok=True)


@router.get("/me", response_model=ApiResponse[MyProfile])
def get_me(user: User = Depends(get_current_user)):
    return ApiResponse(success=True, data=_profile(user), message="요청 성공")


@router.patch("/me", response_model=ApiResponse[MyProfile])
def update_me(body: ProfileUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.nickname is not None:
        nickname = body.nickname.strip()
        if not nickname:
            raise HTTPException(status_code=400, detail="닉네임을 입력해 주세요")
        if len(nickname) > NICKNAME_MAX:
            raise HTTPException(status_code=400, detail=f"닉네임은 {NICKNAME_MAX}자 이하여야 합니다")
        user.nickname = nickname
    if body.marketing_agreed is not None:
        user.marketing_agreed = body.marketing_agreed
    if body.price_alert_enabled is not None:
        user.price_alert_enabled = body.price_alert_enabled
    db.commit()
    db.refresh(user)
    return ApiResponse(success=True, data=_profile(user), message="회원 정보가 수정되었습니다")


@router.post("/me/avatar", response_model=ApiResponse[MyProfile], status_code=201)
async def upload_avatar(
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """프로필 사진을 올린다. 이전 사진이 있으면 파일과 DB 경로를 교체한다."""
    data = await file.read(AVATAR_MAX_BYTES + 1)
    if len(data) > AVATAR_MAX_BYTES:
        raise HTTPException(status_code=413, detail="프로필 사진은 2MB 이하만 올릴 수 있습니다")
    extension = _image_extension(data)
    if not extension:
        raise HTTPException(status_code=400, detail="JPG, PNG, WebP 사진만 올릴 수 있습니다")

    name = f"{uuid4().hex}.{extension}"
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    (AVATAR_DIR / name).write_bytes(data)

    old = user.avatar_url
    user.avatar_url = f"{AVATAR_URL_PREFIX}/{name}"
    db.commit()
    db.refresh(user)
    _delete_avatar_file(old)

    return ApiResponse(success=True, data=_profile(user), message="프로필 사진을 올렸습니다")


@router.delete("/me/avatar", response_model=ApiResponse[MyProfile])
def delete_avatar(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    old = user.avatar_url
    user.avatar_url = None
    db.commit()
    db.refresh(user)
    _delete_avatar_file(old)
    return ApiResponse(success=True, data=_profile(user), message="프로필 사진을 삭제했습니다")


@router.put("/me/password", response_model=ApiResponse[None])
def change_password(body: PasswordChangeRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.password_hash is None:
        raise HTTPException(status_code=400, detail="구글로 가입한 계정은 비밀번호를 변경할 수 없습니다")
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="현재 비밀번호가 올바르지 않습니다")
    if len(body.new_password) < PASSWORD_MIN:
        raise HTTPException(status_code=400, detail=f"비밀번호는 {PASSWORD_MIN}자 이상이어야 합니다")
    if verify_password(body.new_password, user.password_hash):
        raise HTTPException(status_code=400, detail="현재 비밀번호와 다른 비밀번호를 입력해 주세요")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return ApiResponse(success=True, data=None, message="비밀번호가 변경되었습니다")


@router.post("/me/withdraw", response_model=ApiResponse[None])
def withdraw(body: WithdrawRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 비밀번호가 있는 계정은 본인 확인을 위해 비밀번호를 한 번 더 받는다
    if user.password_hash is not None and not (body.password and verify_password(body.password, user.password_hash)):
        raise HTTPException(status_code=400, detail="비밀번호가 올바르지 않습니다")
    avatar_url = user.avatar_url
    # 계좌·주문·보유 종목·피드 글·좋아요·댓글은 DB의 ON DELETE CASCADE로 함께 지워진다
    db.delete(user)
    db.commit()
    _delete_avatar_file(avatar_url)
    return ApiResponse(success=True, data=None, message="회원 탈퇴가 완료되었습니다")

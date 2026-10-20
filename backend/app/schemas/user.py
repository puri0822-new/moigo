from datetime import datetime

from pydantic import BaseModel


class MyProfile(BaseModel):
    email: str
    nickname: str
    login_type: str
    # 구글로만 가입한 회원은 비밀번호가 없어서 비밀번호 변경 칸을 숨긴다
    has_password: bool
    marketing_agreed: bool
    price_alert_enabled: bool
    created_at: datetime


class ProfileUpdateRequest(BaseModel):
    nickname: str | None = None
    marketing_agreed: bool | None = None
    price_alert_enabled: bool | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class WithdrawRequest(BaseModel):
    # 비밀번호가 있는 회원만 확인용으로 보낸다
    password: str | None = None

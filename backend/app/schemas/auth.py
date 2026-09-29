from pydantic import BaseModel, EmailStr


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    nickname: str
    marketing_agreed: bool = False


class SignupResponseData(BaseModel):
    user_id: int
    email: str
    nickname: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponseData(BaseModel):
    access_token: str
    token_type: str = "bearer"


# 하위 호환용 별칭
TokenResponse = TokenResponseData

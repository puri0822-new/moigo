from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    DATABASE_URL: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    TOSS_CLIENT_ID: str = ""
    TOSS_CLIENT_SECRET: str = ""

    NAVER_CLIENT_ID: str = ""
    NAVER_CLIENT_SECRET: str = ""

    GEMINI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""  # 있으면 GEMINI_API_KEY보다 우선
    GEMINI_MODEL: str = "gemini-3.8-flash"
    GROQ_API_KEY: str = ""  # Groq 무료 플랜 키 (GPT 자리에 OpenAI 공개 모델 gpt-oss 사용)
    GPT_MODEL: str = "openai/gpt-oss-120b"

    CLOVA_API_KEY: str = ""
    CLOVA_MODEL: str = "HCX-005"

    FIREBASE_SERVICE_ACCOUNT_PATH: str = ""


settings = Settings()

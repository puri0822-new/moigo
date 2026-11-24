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

    FIREBASE_SERVICE_ACCOUNT_PATH: str = ""

    # AI 추천. 키가 없는 모델은 추천을 만들지 않고 AI 분석 화면에서도 숨긴다
    CLOVA_API_KEY: str = ""
    CLOVA_MODEL: str = "HCX-005"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-opus-5-5"
    # 평일 이 시각(KST, 장 마감 뒤) 이후에 그날 추천을 한 번 만든다. False면 자동 실행을 끈다
    AI_SCHEDULER_ENABLED: bool = True
    AI_RECOMMEND_HOUR: int = 16

    # 브라우저에서 API를 부를 수 있는 화면 주소 (쉼표로 여러 개). 배포에서는 화면과 API가 같은 주소라 필요 없다
    CORS_ORIGINS: str = "http://localhost:5173"


settings = Settings()

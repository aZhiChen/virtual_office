from pathlib import Path

from pydantic_settings import BaseSettings
from typing import List

# Resolve .env path relative to backend/ (config is at app/core/config.py)
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./virtual_office.db"

    # JWT
    SECRET_KEY: str = "change-me-to-a-random-secret-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # LLM (OpenAI-compatible)
    LLM_BASE_URL: str = "https://api.zhizengzeng.com/v1"
    LLM_API_KEY: str = "your_key"
    LLM_MODEL: str = "gpt-4o"
    LLM_TIMEOUT_SECONDS: int = 30
    LLM_MAX_CONTEXT_MESSAGES: int = 10

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://10.203.0.16:3000",
    ]

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"

    model_config = {
        "env_file": str(_ENV_FILE) if _ENV_FILE.exists() else ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()

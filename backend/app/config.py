from pathlib import Path

from pydantic import Field, PostgresDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite"


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: PostgresDsn
    gemini_api_key: SecretStr = SecretStr("")
    gemini_model: str = DEFAULT_GEMINI_MODEL
    llm_timeout_seconds: float = Field(default=45, gt=0, le=120)
    max_regenerations: int = Field(default=2, ge=0, le=3)
    qdrant_url: str = "http://127.0.0.1:6333"
    qdrant_collection: str = "course_chunks"
    embedding_model: str = "intfloat/multilingual-e5-small"
    retrieval_limit: int = Field(default=6, ge=1, le=12)
    retrieval_score_threshold: float = Field(default=0.65, ge=-1, le=1)
    jwt_secret: SecretStr = SecretStr("")

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

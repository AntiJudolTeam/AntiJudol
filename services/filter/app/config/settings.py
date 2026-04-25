"""Runtime configuration for the filter service.

Values come from environment variables (`FILTER_*` prefixed) with the root
`.env` as the source-of-truth. `APP_NAME`/`APP_VERSION` stay hardcoded because
they identify the build, not the deployment.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# services/filter/app/config/settings.py → repo root .env
ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"

VALID_LOG_LEVELS = frozenset({"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"})


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_ENV),
        env_file_encoding="utf-8",
        env_prefix="FILTER_",
        extra="ignore",
    )

    # Build identity (not env-driven)
    APP_NAME: str = "Anti Judol Filter API"
    APP_VERSION: str = "1.0.0"

    # FILTER_-prefixed
    HOST: str = "127.0.0.1"
    PORT: int = 9000
    CORS_ORIGINS: list[str] = ["*"]
    LOG_LEVEL: str = "INFO"
    MODEL_BATCH_SIZE: int = 32
    MODEL_MAX_LENGTH: int = 512

    # Shared (no prefix — bypasses env_prefix via validation_alias)
    ENVIRONMENT: str = Field(
        default="development",
        validation_alias=AliasChoices("ENVIRONMENT"),
    )

    @field_validator("LOG_LEVEL")
    @classmethod
    def _validate_log_level(cls, value: str) -> str:
        upper = value.upper()
        if upper not in VALID_LOG_LEVELS:
            raise ValueError(f"FILTER_LOG_LEVEL must be one of {sorted(VALID_LOG_LEVELS)}, got {value!r}")
        return upper

    @property
    def DEBUG(self) -> bool:
        return self.ENVIRONMENT == "development"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

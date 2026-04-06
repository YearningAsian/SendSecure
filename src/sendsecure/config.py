from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = Field(default="SendSec", validation_alias="APP_NAME")
    environment: str = Field(default="development", validation_alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")
    database_path: str = Field(default="var/sendsec.db", validation_alias="DATABASE_PATH")
    cors_origins: str = Field(default="", validation_alias="CORS_ORIGINS")
    app_secret_key: str = Field(..., validation_alias="APP_SECRET_KEY")
    token_ttl_minutes: int = Field(default=60, validation_alias="TOKEN_TTL_MINUTES")
    jwt_issuer: str = Field(default="sendsec", validation_alias="JWT_ISSUER")
    jwt_audience: str = Field(default="sendsec-api", validation_alias="JWT_AUDIENCE")

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parents[2]

    def resolved_database_path(self) -> Path:
        database_path = Path(self.database_path)
        if database_path.is_absolute():
            return database_path

        resolved_path = (self.project_root / database_path).resolve()
        if self.project_root not in resolved_path.parents and resolved_path != self.project_root:
            raise ValueError("DATABASE_PATH must stay within the project workspace")
        return resolved_path

    def resolved_cors_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.cors_origins.split(",")]
        return [origin for origin in origins if origin]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    ENV: Literal["local", "staging", "production"] = "local"
    DEBUG: bool = True
    PROJECT_NAME: str = "Imaquina Robotica"
    API_V1: str = "/api/v1"

    # --- Base de datos -------------------------------------------------
    DATABASE_URL: PostgresDsn = Field(
        default="postgresql+asyncpg://imaquina:imaquina@localhost:5432/imaquina"
    )
    DB_ECHO: bool = False

    # --- Redis (cache + cola ARQ) --------------------------------------
    REDIS_URL: RedisDsn = Field(default="redis://localhost:6379/0")

    # --- Seguridad -----------------------------------------------------
    SECRET_KEY: str = "cambiar-en-produccion-por-favor"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = 15
    REFRESH_TOKEN_DAYS: int = 30
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # --- Almacenamiento de media (S3 / Cloudflare R2) -------------------
    S3_ENDPOINT_URL: str | None = None
    S3_BUCKET: str = "imaquina-media"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_REGION: str = "auto"
    PRESIGNED_URL_TTL: int = 3600
    MAX_UPLOAD_MB: int = 512
    # URL pública desde la que se SIRVE lo subido (CDN/bucket público), para
    # construir el `body` que el editor guarda en los bloques image/audio.
    # Si no está configurada (dev sin bucket real), se usa `S3_ENDPOINT_URL`.
    S3_PUBLIC_URL: str | None = None

    def media_url(self, s3_key: str) -> str:
        base = (self.S3_PUBLIC_URL or self.S3_ENDPOINT_URL or "").rstrip("/")
        return f"{base}/{self.S3_BUCKET}/{s3_key}"

    # --- Claude / asistente --------------------------------------------
    # Ver docs/arquitectura.md 4. El modelo es palanca de costo: medir antes de bajar.
    ANTHROPIC_API_KEY: str = ""
    ASSISTANT_MODEL: str = "claude-opus-5"
    GUARDRAIL_MODEL: str = "claude-haiku-4-5"
    ASSISTANT_MAX_TOKENS: int = 4096
    CHAT_RATE_LIMIT_PER_HOUR: int = 60
    # C4: datos de menores (Ley 1581) -- retención acotada, se borra de
    # verdad al expirar, no se marca.
    CHAT_RETENTION_DAYS: int = 180
    RAG_TOP_K: int = 6
    EMBEDDING_DIM: int = 1024

    @property
    def sync_database_url(self) -> str:
        """Alembic usa driver sincrono."""
        return str(self.DATABASE_URL).replace("+asyncpg", "+psycopg")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

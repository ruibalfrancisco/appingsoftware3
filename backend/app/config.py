"""Configuración leída de variables de entorno (Railway, GitHub Actions o un .env local)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # El .env vive en la raíz del monorepo; se acepta también uno dentro de backend/.
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://reclamos:reclamos@localhost:5432/reclamos"
    # Lista separada por comas. La API rechaza cualquier otro origen.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Railway la define sola en cada ambiente (staging, production).
    railway_environment_name: str = "local"

    @property
    def lista_cors_origins(self) -> list[str]:
        return [origen.strip() for origen in self.cors_origins.split(",") if origen.strip()]

    @property
    def sqlalchemy_database_url(self) -> str:
        """Railway entrega `postgresql://`; SQLAlchemy necesita saber que el driver es psycopg 3."""
        url = self.database_url
        for prefijo in ("postgres://", "postgresql://"):
            if url.startswith(prefijo):
                return "postgresql+psycopg://" + url.removeprefix(prefijo)
        return url


@lru_cache
def obtener_settings() -> Settings:
    return Settings()

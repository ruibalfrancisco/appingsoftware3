"""Configuración leída de variables de entorno (Railway, GitHub Actions o un .env local)."""

from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Solo sirve en tu máquina y en CI: en Railway la API se niega a arrancar con este valor.
JWT_SECRET_DE_DESARROLLO = "solo-para-desarrollo-local-no-usar-en-railway"  # noqa: S105


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # El .env vive en la raíz del monorepo; se acepta también uno dentro de backend/.
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://reclamos:reclamos@127.0.0.1:5432/reclamos"
    # Lista separada por comas. En Railway la web hace de proxy de /api, así que casi no se usa.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Railway la define sola en cada ambiente (staging, production).
    railway_environment_name: str = "local"

    # Sesión (RNF-07): JWT firmado dentro de una cookie httpOnly.
    jwt_secret: str = JWT_SECRET_DE_DESARROLLO
    sesion_dias: int = 7

    # Para armar los enlaces de los emails (verificación y recuperación).
    frontend_url: str = "http://localhost:5173"

    # Email: smtp (Mailpit) en local y CI, resend en Railway, memoria en las pruebas.
    email_backend: Literal["smtp", "resend", "memoria"] = "smtp"
    email_from: str = "Reclamos Villa Allende <no-responder@reclamos.local>"
    smtp_host: str = "127.0.0.1"
    smtp_port: int = 1025
    resend_api_key: str = ""

    # Fotos: bucket S3 (RustFS en local y CI, Railway Bucket en la nube). Mismos nombres que las
    # variables que Railway inyecta desde el bucket.
    aws_endpoint_url: str = "http://127.0.0.1:9000"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_default_region: str = "us-east-1"
    aws_s3_bucket_name: str = "fotos"
    # RustFS necesita "path" (http://host/bucket/clave); en la nube puede ser "virtual".
    aws_s3_addressing_style: Literal["path", "virtual", "auto"] = "path"

    @model_validator(mode="after")
    def _secretos_obligatorios_en_railway(self) -> "Settings":
        if self.es_railway and self.jwt_secret == JWT_SECRET_DE_DESARROLLO:
            raise ValueError("Falta JWT_SECRET: generalo con `openssl rand -hex 32`")
        if self.es_railway and len(self.jwt_secret) < 32:
            raise ValueError("JWT_SECRET tiene que tener al menos 32 caracteres")
        if self.email_backend == "resend" and not self.resend_api_key:
            raise ValueError("EMAIL_BACKEND=resend necesita RESEND_API_KEY")
        return self

    @property
    def es_railway(self) -> bool:
        return self.railway_environment_name != "local"

    @property
    def cookie_segura(self) -> bool:
        """En Railway todo va por HTTPS; en local y en CI, por http://localhost."""
        return self.es_railway

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

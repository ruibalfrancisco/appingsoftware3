"""Almacenamiento de fotos en un bucket compatible con S3.

El mismo código sirve para RustFS (local y CI) y para el Railway Bucket (staging y producción):
solo cambian las variables AWS_*. El bucket es privado; el navegador ve las fotos con URLs
firmadas que vencen en 1 hora.
"""

from functools import lru_cache
from typing import TYPE_CHECKING, Protocol

import boto3
from botocore.config import Config

from app.config import Settings, obtener_settings

if TYPE_CHECKING:
    from mypy_boto3_s3.client import S3Client

VIGENCIA_URL_SEGUNDOS = 3600


class AlmacenDeFotos(Protocol):
    def guardar(self, clave: str, contenido: bytes, tipo_mime: str) -> None: ...

    def url_firmada(self, clave: str) -> str: ...

    def borrar(self, clave: str) -> None: ...


class AlmacenS3:
    def __init__(self, settings: Settings) -> None:
        self.bucket = settings.aws_s3_bucket_name
        self.cliente: S3Client = boto3.client(
            "s3",
            endpoint_url=settings.aws_endpoint_url or None,
            aws_access_key_id=settings.aws_access_key_id or None,
            aws_secret_access_key=settings.aws_secret_access_key or None,
            region_name=settings.aws_default_region,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": settings.aws_s3_addressing_style},
                connect_timeout=5,
                read_timeout=30,
                retries={"max_attempts": 3},
            ),
        )

    def guardar(self, clave: str, contenido: bytes, tipo_mime: str) -> None:
        self.cliente.put_object(
            Bucket=self.bucket, Key=clave, Body=contenido, ContentType=tipo_mime
        )

    def url_firmada(self, clave: str) -> str:
        return self.cliente.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": clave},
            ExpiresIn=VIGENCIA_URL_SEGUNDOS,
        )

    def borrar(self, clave: str) -> None:
        self.cliente.delete_object(Bucket=self.bucket, Key=clave)


class AlmacenEnMemoria:
    """Para las pruebas: guarda los objetos en un diccionario."""

    def __init__(self) -> None:
        self.objetos: dict[str, tuple[bytes, str]] = {}

    def guardar(self, clave: str, contenido: bytes, tipo_mime: str) -> None:
        self.objetos[clave] = (contenido, tipo_mime)

    def url_firmada(self, clave: str) -> str:
        return f"https://fotos.example/{clave}?firma=prueba"

    def borrar(self, clave: str) -> None:
        self.objetos.pop(clave, None)


@lru_cache
def obtener_almacen() -> AlmacenDeFotos:
    """Dependencia de FastAPI; las pruebas la reemplazan con `dependency_overrides`."""
    return AlmacenS3(obtener_settings())

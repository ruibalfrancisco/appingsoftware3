"""Contraseñas (Argon2), sesión (JWT) y tokens de un solo uso para los enlaces por email."""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()

ALGORITMO_JWT = "HS256"


def ahora() -> datetime:
    return datetime.now(UTC)


def hashear_password(password: str) -> str:
    return _hasher.hash(password)


def verificar_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def necesita_rehash(password_hash: str) -> bool:
    """True si el hash se hizo con parámetros más débiles que los actuales."""
    return _hasher.check_needs_rehash(password_hash)


# Hash de Argon2 de una contraseña cualquiera: se verifica contra él cuando el usuario no
# existe, para que la respuesta tarde lo mismo y no revele qué DNI o email están registrados.
HASH_SEÑUELO = _hasher.hash(secrets.token_urlsafe(16))


@dataclass(frozen=True)
class DatosSesion:
    usuario_id: int
    version: int


class SesionInvalidaError(Exception):
    pass


def crear_jwt(datos: DatosSesion, secreto: str, duracion: timedelta, momento: datetime) -> str:
    carga = {
        "sub": str(datos.usuario_id),
        "ver": datos.version,
        "iat": momento,
        "exp": momento + duracion,
    }
    return jwt.encode(carga, secreto, algorithm=ALGORITMO_JWT)


def leer_jwt(token: str, secreto: str) -> DatosSesion:
    try:
        carga = jwt.decode(
            token, secreto, algorithms=[ALGORITMO_JWT], options={"require": ["sub", "exp"]}
        )
        return DatosSesion(usuario_id=int(carga["sub"]), version=int(carga.get("ver", 0)))
    except (jwt.InvalidTokenError, ValueError, TypeError) as error:
        raise SesionInvalidaError from error


def hash_de_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def generar_token_de_enlace() -> tuple[str, str]:
    """Devuelve (token para el enlace, hash para la base). El token nunca se guarda."""
    token = secrets.token_urlsafe(32)
    return token, hash_de_token(token)

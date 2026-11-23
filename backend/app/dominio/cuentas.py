"""Reglas de cuentas (CU-01, CU-02, CU-03, CU-11) como funciones puras."""

from dataclasses import dataclass
from datetime import datetime, timedelta

PASSWORD_MIN = 8
PASSWORD_MAX = 128

# CU-02: el enlace de verificación vence a las 24 h. CU-11: el de recuperación, en 1 h.
VIGENCIA_VERIFICACION = timedelta(hours=24)
VIGENCIA_RECUPERACION = timedelta(hours=1)

# CU-03: 5 intentos fallidos en 15 minutos bloquean temporalmente (15 minutos).
MAX_INTENTOS = 5
VENTANA_INTENTOS = timedelta(minutes=15)
DURACION_BLOQUEO = timedelta(minutes=15)


class PasswordInvalidaError(ValueError):
    pass


def validar_password(password: str) -> str:
    if len(password) < PASSWORD_MIN:
        raise PasswordInvalidaError(
            f"La contraseña tiene que tener al menos {PASSWORD_MIN} caracteres"
        )
    if len(password) > PASSWORD_MAX:
        raise PasswordInvalidaError(f"La contraseña puede tener hasta {PASSWORD_MAX} caracteres")
    if password.strip() == "":
        raise PasswordInvalidaError("La contraseña no puede ser solo espacios")
    return password


def normalizar_email(email: str) -> str:
    return email.strip().lower()


def token_vigente(expira_en: datetime, usado_en: datetime | None, ahora: datetime) -> bool:
    """Un enlace sirve una sola vez y solo antes de vencer."""
    return usado_en is None and ahora < expira_en


@dataclass(frozen=True)
class EstadoIntentos:
    intentos_fallidos: int = 0
    ultimo_fallo_en: datetime | None = None
    bloqueado_hasta: datetime | None = None


def esta_bloqueado(estado: EstadoIntentos, ahora: datetime) -> bool:
    return estado.bloqueado_hasta is not None and ahora < estado.bloqueado_hasta


def registrar_fallo(estado: EstadoIntentos, ahora: datetime) -> EstadoIntentos:
    """Suma un intento fallido; al quinto dentro de la ventana, bloquea la cuenta."""
    dentro_de_la_ventana = (
        estado.ultimo_fallo_en is not None and ahora - estado.ultimo_fallo_en < VENTANA_INTENTOS
    )
    intentos = estado.intentos_fallidos + 1 if dentro_de_la_ventana else 1
    if intentos >= MAX_INTENTOS:
        return EstadoIntentos(0, None, ahora + DURACION_BLOQUEO)
    return EstadoIntentos(intentos, ahora, None)


def registrar_exito() -> EstadoIntentos:
    return EstadoIntentos()

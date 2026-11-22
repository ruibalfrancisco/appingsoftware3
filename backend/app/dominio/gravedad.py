"""RN-03 Gravedad: entero del 1 al 10, obligatorio al crear y al apoyar."""

from typing import Literal

GRAVEDAD_MIN = 1
GRAVEDAD_MAX = 10

EtiquetaGravedad = Literal["Leve", "Moderado", "Grave", "Urgente"]


class GravedadInvalidaError(ValueError):
    pass


def validar_gravedad(valor: object) -> int:
    # bool es subclase de int en Python: True no es una gravedad válida.
    if isinstance(valor, bool) or not isinstance(valor, int):
        raise GravedadInvalidaError(f"La gravedad tiene que ser un número entero: {valor!r}")
    if not GRAVEDAD_MIN <= valor <= GRAVEDAD_MAX:
        raise GravedadInvalidaError(
            f"La gravedad va de {GRAVEDAD_MIN} a {GRAVEDAD_MAX}; se recibió {valor}"
        )
    return valor


def etiqueta_gravedad(valor: int) -> EtiquetaGravedad:
    validar_gravedad(valor)
    if valor <= 3:
        return "Leve"
    if valor <= 6:
        return "Moderado"
    if valor <= 8:
        return "Grave"
    return "Urgente"

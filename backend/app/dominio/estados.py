"""RN-05 Estados: un reclamo nace Pendiente y solo avanza; Resuelto y Rechazado son finales."""

from enum import StrEnum


class EstadoReclamo(StrEnum):
    PENDIENTE = "PENDIENTE"
    EN_REVISION = "EN_REVISION"
    EN_PROCESO = "EN_PROCESO"
    RESUELTO = "RESUELTO"
    RECHAZADO = "RECHAZADO"


ESTADOS_ABIERTOS = frozenset(
    {EstadoReclamo.PENDIENTE, EstadoReclamo.EN_REVISION, EstadoReclamo.EN_PROCESO}
)

TRANSICIONES: dict[EstadoReclamo, frozenset[EstadoReclamo]] = {
    EstadoReclamo.PENDIENTE: frozenset({EstadoReclamo.EN_REVISION, EstadoReclamo.RECHAZADO}),
    EstadoReclamo.EN_REVISION: frozenset({EstadoReclamo.EN_PROCESO, EstadoReclamo.RECHAZADO}),
    EstadoReclamo.EN_PROCESO: frozenset({EstadoReclamo.RESUELTO}),
    EstadoReclamo.RESUELTO: frozenset(),
    EstadoReclamo.RECHAZADO: frozenset(),
}


class TransicionInvalidaError(ValueError):
    pass


class DatoObligatorioError(ValueError):
    pass


def es_transicion_permitida(actual: EstadoReclamo, nuevo: EstadoReclamo) -> bool:
    return nuevo in TRANSICIONES[actual]


def validar_transicion(
    actual: EstadoReclamo,
    nuevo: EstadoReclamo,
    *,
    comentario: str | None = None,
    area_id: int | None = None,
) -> None:
    """Valida el cambio de estado y lo que exige cada destino (CU-08).

    - Rechazar exige un motivo (va en `comentario`).
    - Pasar a En proceso exige el área responsable.
    - Resolver exige un comentario.
    """
    if not es_transicion_permitida(actual, nuevo):
        raise TransicionInvalidaError(f"No se puede pasar de {actual} a {nuevo}")

    texto = (comentario or "").strip()
    if nuevo is EstadoReclamo.RECHAZADO and not texto:
        raise DatoObligatorioError("Para rechazar hace falta un motivo")
    if nuevo is EstadoReclamo.RESUELTO and not texto:
        raise DatoObligatorioError("Para resolver hace falta un comentario")
    if nuevo is EstadoReclamo.EN_PROCESO and area_id is None:
        raise DatoObligatorioError("Para pasar a En proceso hace falta asignar un área")

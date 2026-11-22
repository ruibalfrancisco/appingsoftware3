from itertools import product

import pytest

from app.dominio.estados import (
    ESTADOS_ABIERTOS,
    DatoObligatorioError,
    EstadoReclamo,
    TransicionInvalidaError,
    es_transicion_permitida,
    validar_transicion,
)

E = EstadoReclamo

PERMITIDAS = {
    (E.PENDIENTE, E.EN_REVISION),
    (E.PENDIENTE, E.RECHAZADO),
    (E.EN_REVISION, E.EN_PROCESO),
    (E.EN_REVISION, E.RECHAZADO),
    (E.EN_PROCESO, E.RESUELTO),
}


@pytest.mark.parametrize(("actual", "nuevo"), list(product(E, E)))
def test_ut05_solo_pasan_las_transiciones_del_diagrama(actual: E, nuevo: E) -> None:
    assert es_transicion_permitida(actual, nuevo) == ((actual, nuevo) in PERMITIDAS)


def test_ut05_resuelto_a_pendiente_falla() -> None:
    with pytest.raises(TransicionInvalidaError):
        validar_transicion(E.RESUELTO, E.PENDIENTE, comentario="reabrir")


def test_los_estados_finales_no_estan_abiertos() -> None:
    assert E.RESUELTO not in ESTADOS_ABIERTOS
    assert E.RECHAZADO not in ESTADOS_ABIERTOS
    assert {E.PENDIENTE, E.EN_REVISION, E.EN_PROCESO} == ESTADOS_ABIERTOS


@pytest.mark.parametrize("comentario", [None, "", "   "])
def test_rechazar_exige_motivo(comentario: str | None) -> None:
    with pytest.raises(DatoObligatorioError, match="motivo"):
        validar_transicion(E.PENDIENTE, E.RECHAZADO, comentario=comentario)


def test_resolver_exige_comentario() -> None:
    with pytest.raises(DatoObligatorioError, match="comentario"):
        validar_transicion(E.EN_PROCESO, E.RESUELTO)


def test_en_proceso_exige_area() -> None:
    with pytest.raises(DatoObligatorioError, match="área"):
        validar_transicion(E.EN_REVISION, E.EN_PROCESO)


def test_transiciones_validas_con_sus_datos() -> None:
    validar_transicion(E.PENDIENTE, E.EN_REVISION)
    validar_transicion(E.EN_REVISION, E.EN_PROCESO, area_id=1)
    validar_transicion(E.EN_PROCESO, E.RESUELTO, comentario="Bache tapado")
    validar_transicion(E.EN_REVISION, E.RECHAZADO, comentario="Es propiedad privada")

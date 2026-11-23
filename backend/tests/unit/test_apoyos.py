import pytest

from app.dominio.apoyos import (
    MAX_SIMILARES,
    RADIO_SIMILARES_M,
    ApoyoNoPermitidoError,
    validar_apoyo,
)
from app.dominio.estados import EstadoReclamo
from app.dominio.prioridad import resumir_apoyos


def test_rn01_radio_de_50_metros_y_hasta_5_similares() -> None:
    assert RADIO_SIMILARES_M == 50
    assert MAX_SIMILARES == 5


@pytest.mark.parametrize(
    "estado", [EstadoReclamo.PENDIENTE, EstadoReclamo.EN_REVISION, EstadoReclamo.EN_PROCESO]
)
def test_rn02_un_vecino_nuevo_apoya_un_reclamo_abierto(estado: EstadoReclamo) -> None:
    validar_apoyo(es_creador=False, ya_apoyo=False, estado=estado)


def test_rn02_el_creador_no_apoya_su_propio_reclamo() -> None:
    # El creador también tiene un apoyo guardado; igual el motivo es que es suyo.
    with pytest.raises(ApoyoNoPermitidoError, match="Es tu reclamo"):
        validar_apoyo(es_creador=True, ya_apoyo=True, estado=EstadoReclamo.PENDIENTE)


def test_rn02_un_vecino_apoya_una_sola_vez() -> None:
    with pytest.raises(ApoyoNoPermitidoError, match="Ya apoyaste"):
        validar_apoyo(es_creador=False, ya_apoyo=True, estado=EstadoReclamo.PENDIENTE)


@pytest.mark.parametrize("estado", [EstadoReclamo.RESUELTO, EstadoReclamo.RECHAZADO])
def test_rn04_un_reclamo_cerrado_no_suma_apoyos(estado: EstadoReclamo) -> None:
    with pytest.raises(ApoyoNoPermitidoError, match="cerrado"):
        validar_apoyo(es_creador=False, ya_apoyo=False, estado=estado)


def test_resumen_de_apoyos_guarda_cantidad_promedio_y_prioridad() -> None:
    resumen = resumir_apoyos([9, 9, 9])  # Semáforo roto de la tabla de RN-04

    assert resumen.cantidad == 3
    assert resumen.gravedad_promedio == 9
    assert resumen.prioridad == pytest.approx(23.3, abs=0.05)


def test_resumen_con_el_creador_solo() -> None:
    resumen = resumir_apoyos([6])

    assert (resumen.cantidad, resumen.gravedad_promedio, resumen.prioridad) == (1, 6, 6)

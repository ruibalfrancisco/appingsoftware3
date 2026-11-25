from datetime import UTC, date, datetime

import pytest

from app.dominio.estados import EstadoReclamo
from app.dominio.gestion import (
    destinatarios_de_novedad,
    es_final,
    es_personal_municipal,
    rango_de_fechas,
    transiciones_desde,
)


@pytest.mark.parametrize(
    ("rol", "esperado"), [("operador", True), ("admin", True), ("vecino", False)]
)
def test_solo_operadores_y_administradores_son_personal_municipal(rol: str, esperado: bool) -> None:
    assert es_personal_municipal(rol) is esperado


def test_transiciones_que_ofrece_cada_estado_rn05() -> None:
    assert transiciones_desde("PENDIENTE") == [
        EstadoReclamo.EN_REVISION,
        EstadoReclamo.RECHAZADO,
    ]
    assert transiciones_desde("EN_REVISION") == [
        EstadoReclamo.EN_PROCESO,
        EstadoReclamo.RECHAZADO,
    ]
    assert transiciones_desde("EN_PROCESO") == [EstadoReclamo.RESUELTO]
    assert transiciones_desde("RESUELTO") == []
    assert transiciones_desde("RECHAZADO") == []


@pytest.mark.parametrize(
    ("estado", "final"),
    [("PENDIENTE", False), ("EN_PROCESO", False), ("RESUELTO", True), ("RECHAZADO", True)],
)
def test_resuelto_y_rechazado_son_finales(estado: str, final: bool) -> None:
    assert es_final(estado) is final


def test_rn07_novedad_para_el_creador_y_los_que_apoyaron_sin_repetir() -> None:
    assert destinatarios_de_novedad(1, [4, 2, 4, 1], autor_id=9) == [1, 2, 4]


def test_rn07_quien_hace_el_cambio_no_se_avisa_a_si_mismo() -> None:
    assert destinatarios_de_novedad(1, [2, 9], autor_id=9) == [1, 2]


def test_rango_de_fechas_en_dias_de_cordoba_con_hasta_incluido() -> None:
    inicio, fin = rango_de_fechas(date(2026, 11, 20), date(2026, 11, 23))

    assert inicio == datetime(2026, 11, 20, 3, 0, tzinfo=UTC)  # 00:00 en Córdoba (UTC-3)
    assert fin == datetime(2026, 11, 24, 3, 0, tzinfo=UTC)


def test_rango_de_fechas_abierto() -> None:
    assert rango_de_fechas(None, None) == (None, None)
    assert rango_de_fechas(None, date(2026, 11, 23))[0] is None

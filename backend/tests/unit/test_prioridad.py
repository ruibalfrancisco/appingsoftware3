from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import pytest

from app.dominio.gravedad import GravedadInvalidaError
from app.dominio.prioridad import calcular_prioridad, ordenar_por_prioridad


def test_ut01_con_un_vecino_la_prioridad_es_su_gravedad() -> None:
    assert calcular_prioridad([7]) == 7


def test_ut02_doce_vecinos_con_gravedad_6_da_27_5() -> None:
    assert calcular_prioridad([6] * 12) == pytest.approx(27.5, abs=0.05)


@pytest.mark.parametrize(
    ("vecinos", "gravedad", "esperada"),
    [
        (12, 6, 27.5),  # Bache en avenida
        (3, 9, 23.3),  # Semáforo roto
        (5, 5, 16.6),  # Luminaria rota
        (1, 4, 4.0),  # Basura
    ],
)
def test_tabla_de_ejemplos_de_rn04(vecinos: int, gravedad: int, esperada: float) -> None:
    assert calcular_prioridad([gravedad] * vecinos) == pytest.approx(esperada, abs=0.05)


def test_dos_vecinos_duplican_el_factor() -> None:
    assert calcular_prioridad([5, 5]) == 2 * calcular_prioridad([5])


def test_usa_la_gravedad_promedio() -> None:
    assert calcular_prioridad([2, 10]) == pytest.approx(6 * 2)


def test_sin_apoyos_es_un_error() -> None:
    with pytest.raises(ValueError, match="al menos un apoyo"):
        calcular_prioridad([])


def test_rechaza_gravedades_invalidas() -> None:
    with pytest.raises(GravedadInvalidaError):
        calcular_prioridad([5, 11])


@dataclass(frozen=True)
class ReclamoDePrueba:
    nombre: str
    prioridad: float
    creado_en: datetime


def test_ut03_a_igual_prioridad_va_primero_el_mas_antiguo() -> None:
    ahora = datetime(2026, 11, 22, 12, tzinfo=UTC)
    nuevo = ReclamoDePrueba("nuevo", 10.0, ahora)
    viejo = ReclamoDePrueba("viejo", 10.0, ahora - timedelta(days=3))
    urgente = ReclamoDePrueba("urgente", 20.0, ahora)

    ordenados = ordenar_por_prioridad([nuevo, viejo, urgente])

    assert [r.nombre for r in ordenados] == ["urgente", "viejo", "nuevo"]

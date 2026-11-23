from datetime import UTC, datetime

from app.dominio.reclamos import ZONA_HORARIA, inicio_del_dia, puede_crear_otro


def test_rn08_cinco_reclamos_por_dia() -> None:
    assert puede_crear_otro(0)
    assert puede_crear_otro(4)
    assert not puede_crear_otro(5)


def test_rn08_el_dia_es_el_de_cordoba_no_el_de_utc() -> None:
    # 01:30 UTC del 23 son las 22:30 del 22 en Córdoba (UTC-3).
    madrugada_utc = datetime(2026, 11, 23, 1, 30, tzinfo=UTC)

    inicio = inicio_del_dia(madrugada_utc)

    assert inicio == datetime(2026, 11, 22, 0, 0, tzinfo=ZONA_HORARIA)
    assert inicio.astimezone(UTC) == datetime(2026, 11, 22, 3, 0, tzinfo=UTC)

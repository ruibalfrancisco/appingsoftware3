from typing import Any

import pytest

from app import geocodificacion
from app.geocodificacion import direccion_de, formatear_direccion


@pytest.mark.parametrize(
    ("direccion", "esperada"),
    [
        (
            {
                "road": "Rivera Indarte",
                "house_number": "101",
                "neighbourhood": "Villa Allende Centro",
            },
            "Rivera Indarte 101, Villa Allende Centro",
        ),
        ({"road": "Av. Goycoechea", "suburb": "Lomas Este"}, "Av. Goycoechea, Lomas Este"),
        ({"road": "San Martín"}, "San Martín"),
        ({"pedestrian": "Paseo de la Plaza", "house_number": "5"}, "Paseo de la Plaza 5"),
        ({"suburb": "Golf"}, "Golf"),
        ({"town": "Villa Allende"}, None),
    ],
)
def test_rf10_formato_de_la_direccion(direccion: dict[str, str], esperada: str | None) -> None:
    assert formatear_direccion({"address": direccion}) == esperada


def test_si_nominatim_falla_no_rompe_el_reclamo(monkeypatch: pytest.MonkeyPatch) -> None:
    def sin_red(latitud: float, longitud: float) -> dict[str, Any]:
        raise TimeoutError

    geocodificacion._direccion_cacheada.cache_clear()
    monkeypatch.setattr(geocodificacion, "_consultar_nominatim", sin_red)

    assert direccion_de(-31.2945, -64.2955) is None


def test_puntos_muy_cercanos_usan_la_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    consultas: list[tuple[float, float]] = []

    def falso(latitud: float, longitud: float) -> dict[str, Any]:
        consultas.append((latitud, longitud))
        return {"address": {"road": "Rivera Indarte"}}

    geocodificacion._direccion_cacheada.cache_clear()
    monkeypatch.setattr(geocodificacion, "_consultar_nominatim", falso)

    assert direccion_de(-31.29451, -64.29551) == "Rivera Indarte"
    assert direccion_de(-31.29453, -64.29549) == "Rivera Indarte"  # a ~3 m
    assert consultas == [(-31.2945, -64.2955)]
    geocodificacion._direccion_cacheada.cache_clear()

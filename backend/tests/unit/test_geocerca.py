import pytest

from app.dominio.geocerca import centro_del_ejido, dentro_del_ejido, geojson_del_ejido


@pytest.mark.parametrize(
    ("lugar", "latitud", "longitud"),
    [
        ("centro de Villa Allende", -31.2945, -64.2955),
        ("punto interior que usa el mapa sin GPS", *centro_del_ejido()),
    ],
)
def test_ut06_puntos_dentro_del_ejido(lugar: str, latitud: float, longitud: float) -> None:
    assert dentro_del_ejido(latitud, longitud), lugar


@pytest.mark.parametrize(
    ("lugar", "latitud", "longitud"),
    [
        ("Córdoba capital", -31.4167, -64.1833),
        ("Mendiolaza", -31.2667, -64.3000),
        ("Unquillo", -31.2333, -64.3167),
        ("en medio del océano", 0.0, 0.0),
    ],
)
def test_ut06_puntos_fuera_del_ejido(lugar: str, latitud: float, longitud: float) -> None:
    assert not dentro_del_ejido(latitud, longitud), lugar


def test_ut06_un_punto_sobre_el_borde_es_valido() -> None:
    longitud, latitud = geojson_del_ejido()["features"][0]["geometry"]["coordinates"][0][0]

    assert dentro_del_ejido(latitud, longitud)


def test_el_poligono_cita_su_fuente() -> None:
    propiedades = geojson_del_ejido()["features"][0]["properties"]
    assert "OpenStreetMap" in propiedades["licencia"]

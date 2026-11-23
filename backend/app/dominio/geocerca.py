"""RN-06 Geocerca: la ubicación tiene que caer dentro del ejido de Villa Allende.

El polígono sale de OpenStreetMap (relación 9470225, «Municipio de Villa Allende», licencia
ODbL). El mapa del frontend lo dibuja; el backend lo valida aunque el frontend se saltee.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from shapely.geometry import Point, shape
from shapely.geometry.base import BaseGeometry

RUTA_EJIDO = Path(__file__).resolve().parent.parent / "datos" / "ejido_villa_allende.geojson"


@lru_cache
def geojson_del_ejido() -> dict[str, Any]:
    datos: dict[str, Any] = json.loads(RUTA_EJIDO.read_text(encoding="utf-8"))
    return datos


@lru_cache
def ejido() -> BaseGeometry:
    return shape(geojson_del_ejido()["features"][0]["geometry"])


def dentro_del_ejido(latitud: float, longitud: float) -> bool:
    """`covers` incluye el borde: un reclamo sobre el límite del ejido es válido."""
    return bool(ejido().covers(Point(longitud, latitud)))


def centro_del_ejido() -> tuple[float, float]:
    """(latitud, longitud) de un punto garantizado dentro del ejido, para abrir el mapa."""
    punto = ejido().representative_point()
    return punto.y, punto.x

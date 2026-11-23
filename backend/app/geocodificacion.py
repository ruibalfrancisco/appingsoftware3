"""RF-10: dirección aproximada a partir del pin, con Nominatim (OpenStreetMap).

Se consulta desde el backend y no desde el navegador: así se respeta la política de uso de
Nominatim (máximo 1 pedido por segundo, User-Agent que identifique la app, caché) y la IP del
vecino no le llega a terceros. Si Nominatim no responde, el vecino escribe la dirección a mano.
"""

import json
import logging
import threading
import time
import urllib.parse
import urllib.request
from functools import lru_cache
from typing import Any

log = logging.getLogger(__name__)

URL_NOMINATIM = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "reclamos-villa-allende/0.1 (proyecto academico)"
INTERVALO_MINIMO = 1.0  # segundos entre pedidos (política de Nominatim)

_candado = threading.Lock()
_ultimo_pedido = 0.0


def formatear_direccion(respuesta: dict[str, Any]) -> str | None:
    """ "Rivera Indarte 101, Villa Allende Centro" a partir de la respuesta de Nominatim."""
    datos = respuesta.get("address") or {}
    calle = next(
        (datos[k] for k in ("road", "pedestrian", "footway", "path", "square") if datos.get(k)),
        None,
    )
    barrio = next(
        (datos[k] for k in ("neighbourhood", "suburb", "quarter", "hamlet") if datos.get(k)),
        None,
    )
    if calle and datos.get("house_number"):
        calle = f"{calle} {datos['house_number']}"
    partes = [p for p in (calle, barrio) if p]
    return ", ".join(partes) if partes else None


def _consultar_nominatim(latitud: float, longitud: float) -> dict[str, Any]:
    global _ultimo_pedido
    parametros = urllib.parse.urlencode(
        {
            "format": "jsonv2",
            "lat": f"{latitud:.6f}",
            "lon": f"{longitud:.6f}",
            "zoom": 18,
            "addressdetails": 1,
            "accept-language": "es",
        }
    )
    pedido = urllib.request.Request(  # noqa: S310 (URL fija con https)
        f"{URL_NOMINATIM}?{parametros}", headers={"User-Agent": USER_AGENT}
    )
    with _candado:  # un pedido por segundo para todo el proceso
        espera = INTERVALO_MINIMO - (time.monotonic() - _ultimo_pedido)
        if espera > 0:
            time.sleep(espera)
        _ultimo_pedido = time.monotonic()
    with urllib.request.urlopen(pedido, timeout=4) as respuesta:  # noqa: S310
        datos: dict[str, Any] = json.load(respuesta)
        return datos


@lru_cache(maxsize=2048)
def _direccion_cacheada(latitud: float, longitud: float) -> str | None:
    return formatear_direccion(_consultar_nominatim(latitud, longitud))


def direccion_de(latitud: float, longitud: float) -> str | None:
    """Dirección aproximada, o None si no se pudo obtener (nunca rompe el flujo del reclamo)."""
    # Redondeo a ~10 m: puntos muy cercanos comparten la misma consulta en caché.
    try:
        return _direccion_cacheada(round(latitud, 4), round(longitud, 4))
    except Exception:
        log.warning("Nominatim no respondió para %.4f, %.4f", latitud, longitud, exc_info=True)
        return None

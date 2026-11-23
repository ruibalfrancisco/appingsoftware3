"""Reglas de la creación de reclamos (CU-04)."""

from datetime import datetime, time
from zoneinfo import ZoneInfo

DESCRIPCION_MAX = 500
DIRECCION_MAX = 200

# RN-08 Antispam: máximo 5 reclamos nuevos por vecino por día; los apoyos no cuentan.
MAX_RECLAMOS_POR_DIA = 5

# RNF-14: el "día" es el de Córdoba, no el de UTC.
ZONA_HORARIA = ZoneInfo("America/Argentina/Cordoba")


def inicio_del_dia(momento: datetime) -> datetime:
    """Medianoche (hora de Córdoba) del día de `momento`, como datetime con zona horaria."""
    local = momento.astimezone(ZONA_HORARIA)
    return datetime.combine(local.date(), time.min, tzinfo=ZONA_HORARIA)


def puede_crear_otro(reclamos_de_hoy: int) -> bool:
    return reclamos_de_hoy < MAX_RECLAMOS_POR_DIA

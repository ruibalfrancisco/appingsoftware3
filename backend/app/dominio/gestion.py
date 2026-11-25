"""Reglas del back office municipal (CU-07 a CU-10)."""

from collections.abc import Iterable
from datetime import date, datetime, time, timedelta

from app.dominio.estados import TRANSICIONES, EstadoReclamo
from app.dominio.reclamos import ZONA_HORARIA

ROLES_MUNICIPALES = frozenset({"operador", "admin"})

# El Tablero muestra a lo sumo esta cantidad (lista y mapa); con filtros se acota.
MAX_EN_TABLERO = 300

# El orden en que se ofrecen los cambios de estado en la interfaz (RN-05).
_ORDEN = list(EstadoReclamo)


def es_personal_municipal(rol: str) -> bool:
    return rol in ROLES_MUNICIPALES


def transiciones_desde(estado: str) -> list[EstadoReclamo]:
    """Los estados a los que se puede pasar desde `estado` (vacío si es final)."""
    return sorted(TRANSICIONES[EstadoReclamo(estado)], key=_ORDEN.index)


def es_final(estado: str) -> bool:
    return not TRANSICIONES[EstadoReclamo(estado)]


def destinatarios_de_novedad(
    creador_id: int, apoyantes_ids: Iterable[int], autor_id: int
) -> list[int]:
    """RN-07: el creador y todos los que apoyaron, una vez cada uno y sin quien hizo el cambio."""
    return sorted(({creador_id} | set(apoyantes_ids)) - {autor_id})


def rango_de_fechas(
    desde: date | None, hasta: date | None
) -> tuple[datetime | None, datetime | None]:
    """Filtro por fecha de carga: días enteros de Córdoba, `hasta` incluido (RNF-14).

    Devuelve [inicio, fin) para comparar con creado_en.
    """
    inicio = datetime.combine(desde, time.min, tzinfo=ZONA_HORARIA) if desde else None
    fin = (
        datetime.combine(hasta + timedelta(days=1), time.min, tzinfo=ZONA_HORARIA)
        if hasta
        else None
    )
    return inicio, fin

"""RN-04 Prioridad = gravedad promedio x (1 + log2 n).

n es la cantidad de vecinos que apoyan (creador incluido). El logaritmo hace que la
cantidad sume sin aplastar a la gravedad: 2 vecinos duplican el factor, 4 lo triplican.
A igual prioridad, va primero el reclamo más antiguo.
"""

import math
from collections.abc import Iterable, Sequence
from datetime import datetime
from typing import Protocol

from app.dominio.gravedad import validar_gravedad


def calcular_prioridad(gravedades: Sequence[int]) -> float:
    """Recibe la gravedad de cada apoyo (el del creador incluido)."""
    if not gravedades:
        raise ValueError("Un reclamo tiene al menos un apoyo: el de su creador")
    for gravedad in gravedades:
        validar_gravedad(gravedad)
    cantidad = len(gravedades)
    promedio = sum(gravedades) / cantidad
    return promedio * (1 + math.log2(cantidad))


class Priorizable(Protocol):
    @property
    def prioridad(self) -> float: ...

    @property
    def creado_en(self) -> datetime: ...


def ordenar_por_prioridad[T: Priorizable](reclamos: Iterable[T]) -> list[T]:
    """Mayor prioridad primero; a igual prioridad, el más antiguo primero."""
    return sorted(reclamos, key=lambda r: (-r.prioridad, r.creado_en))

"""RN-01 Antiduplicados y RN-02 Apoyo ("Yo también lo vi")."""

from app.dominio.estados import ESTADOS_ABIERTOS

# RN-01: reclamos abiertos del mismo tipo a 50 m o menos; se muestran hasta 5, del más cercano.
RADIO_SIMILARES_M = 50
MAX_SIMILARES = 5


class ApoyoNoPermitidoError(ValueError):
    """El vecino no puede sumar su apoyo a ese reclamo; el mensaje es para mostrarle."""


def validar_apoyo(*, es_creador: bool, ya_apoyo: bool, estado: str) -> None:
    """RN-02: un apoyo por vecino y nunca al reclamo propio. RN-04: solo reclamos abiertos."""
    if es_creador:
        raise ApoyoNoPermitidoError("Es tu reclamo: ya cuenta como el primer apoyo")
    if ya_apoyo:
        raise ApoyoNoPermitidoError("Ya apoyaste este reclamo")
    if estado not in ESTADOS_ABIERTOS:
        raise ApoyoNoPermitidoError("Este reclamo ya está cerrado: no suma más apoyos")

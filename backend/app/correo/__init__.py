"""Envío de emails con inversión de dependencias.

El resto del código depende de la interfaz `EnviadorDeEmail`, no de un proveedor. La variable
EMAIL_BACKEND elige la implementación: Resend en Railway, SMTP (Mailpit) en local y CI, y
memoria en las pruebas.
"""

import json
import logging
import smtplib
import urllib.request
from dataclasses import dataclass
from email.message import EmailMessage
from functools import lru_cache
from typing import Protocol

from app.config import Settings, obtener_settings

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Mensaje:
    para: str
    asunto: str
    texto: str
    html: str


class EnviadorDeEmail(Protocol):
    def enviar(self, mensaje: Mensaje) -> None: ...


class EnviadorSmtp:
    def __init__(self, host: str, puerto: int, remitente: str) -> None:
        self.host, self.puerto, self.remitente = host, puerto, remitente

    def enviar(self, mensaje: Mensaje) -> None:
        email = EmailMessage()
        email["From"] = self.remitente
        email["To"] = mensaje.para
        email["Subject"] = mensaje.asunto
        email.set_content(mensaje.texto)
        email.add_alternative(mensaje.html, subtype="html")
        with smtplib.SMTP(self.host, self.puerto, timeout=10) as servidor:
            servidor.send_message(email)


class EnviadorResend:
    URL = "https://api.resend.com/emails"

    def __init__(self, api_key: str, remitente: str) -> None:
        self.api_key, self.remitente = api_key, remitente

    def enviar(self, mensaje: Mensaje) -> None:
        cuerpo = {
            "from": self.remitente,
            "to": [mensaje.para],
            "subject": mensaje.asunto,
            "text": mensaje.texto,
            "html": mensaje.html,
        }
        pedido = urllib.request.Request(  # noqa: S310 (URL fija con https)
            self.URL,
            data=json.dumps(cuerpo).encode(),
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "User-Agent": "reclamos-villa-allende/1.0",
            },
        )
        with urllib.request.urlopen(pedido, timeout=10) as respuesta:  # noqa: S310
            if respuesta.status >= 300:
                raise RuntimeError(f"Resend respondió {respuesta.status}")


class EnviadorEnMemoria:
    """Guarda los mensajes en una lista: lo usan las pruebas para leer los enlaces."""

    def __init__(self) -> None:
        self.enviados: list[Mensaje] = []

    def enviar(self, mensaje: Mensaje) -> None:
        self.enviados.append(mensaje)


def crear_enviador(settings: Settings) -> EnviadorDeEmail:
    if settings.email_backend == "resend":
        return EnviadorResend(settings.resend_api_key, settings.email_from)
    if settings.email_backend == "memoria":
        return EnviadorEnMemoria()
    return EnviadorSmtp(settings.smtp_host, settings.smtp_port, settings.email_from)


@lru_cache
def obtener_enviador() -> EnviadorDeEmail:
    """Dependencia de FastAPI; las pruebas la reemplazan con `dependency_overrides`."""
    return crear_enviador(obtener_settings())


def enviar_sin_fallar(enviador: EnviadorDeEmail, mensaje: Mensaje) -> None:
    """Se corre en segundo plano: si el proveedor falla, se registra y el vecino puede reenviar."""
    try:
        enviador.enviar(mensaje)
    except Exception:
        log.exception("No se pudo enviar el email «%s»", mensaje.asunto)

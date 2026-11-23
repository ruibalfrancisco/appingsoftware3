import json
from typing import Any

import pytest

from app import correo
from app.config import Settings
from app.correo import (
    EnviadorEnMemoria,
    EnviadorResend,
    EnviadorSmtp,
    Mensaje,
    crear_enviador,
    enviar_sin_fallar,
)
from app.correo.plantillas import email_de_recuperacion, email_de_verificacion

MENSAJE = Mensaje(para="vecina@ejemplo.com", asunto="Hola", texto="texto", html="<p>html</p>")


def test_el_email_de_verificacion_lleva_el_enlace() -> None:
    enlace = "https://reclamos.example/verificar?token=abc"
    mensaje = email_de_verificacion("vecina@ejemplo.com", "Ana", enlace)

    assert mensaje.para == "vecina@ejemplo.com"
    assert enlace in mensaje.texto
    assert 'href="https://reclamos.example/verificar?token=abc"' in mensaje.html
    assert "24 horas" in mensaje.texto


def test_el_email_de_recuperacion_escapa_el_html() -> None:
    mensaje = email_de_recuperacion("v@ejemplo.com", "<script>", "https://x.example/r?token=1")

    assert "<script>" not in mensaje.html
    assert "&lt;script&gt;" in mensaje.html
    assert "1 hora" in mensaje.texto


@pytest.mark.parametrize(
    ("backend", "clase"),
    [("smtp", EnviadorSmtp), ("memoria", EnviadorEnMemoria), ("resend", EnviadorResend)],
)
def test_email_backend_elige_la_implementacion(backend: str, clase: type) -> None:
    settings = Settings(_env_file=None, email_backend=backend, resend_api_key="re_prueba")  # type: ignore[arg-type]

    assert isinstance(crear_enviador(settings), clase)


def test_resend_manda_el_pedido_esperado(monkeypatch: pytest.MonkeyPatch) -> None:
    pedidos: list[Any] = []

    class RespuestaFalsa:
        status = 200

        def __enter__(self) -> "RespuestaFalsa":
            return self

        def __exit__(self, *args: object) -> None:
            return None

    def urlopen_falso(pedido: Any, timeout: int) -> RespuestaFalsa:
        pedidos.append(pedido)
        return RespuestaFalsa()

    monkeypatch.setattr(correo.urllib.request, "urlopen", urlopen_falso)
    EnviadorResend("re_clave", "Reclamos <no-responder@ejemplo.com>").enviar(MENSAJE)

    (pedido,) = pedidos
    assert pedido.full_url == "https://api.resend.com/emails"
    assert pedido.get_header("Authorization") == "Bearer re_clave"
    cuerpo = json.loads(pedido.data)
    assert cuerpo["to"] == ["vecina@ejemplo.com"]
    assert cuerpo["from"] == "Reclamos <no-responder@ejemplo.com>"


def test_smtp_arma_un_email_con_texto_y_html(monkeypatch: pytest.MonkeyPatch) -> None:
    enviados: list[Any] = []

    class SmtpFalso:
        def __init__(self, host: str, puerto: int, timeout: int) -> None:
            assert (host, puerto) == ("mailpit", 1025)

        def __enter__(self) -> "SmtpFalso":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def send_message(self, email: Any) -> None:
            enviados.append(email)

    monkeypatch.setattr(correo.smtplib, "SMTP", SmtpFalso)
    EnviadorSmtp("mailpit", 1025, "no-responder@ejemplo.com").enviar(MENSAJE)

    (email,) = enviados
    assert email["To"] == "vecina@ejemplo.com"
    assert email.is_multipart()


def test_si_el_proveedor_falla_no_se_cae_el_pedido(caplog: pytest.LogCaptureFixture) -> None:
    class EnviadorRoto:
        def enviar(self, mensaje: Mensaje) -> None:
            raise ConnectionError("sin red")

    enviar_sin_fallar(EnviadorRoto(), MENSAJE)

    assert "No se pudo enviar" in caplog.text


def test_el_enviador_en_memoria_guarda_los_mensajes() -> None:
    enviador = EnviadorEnMemoria()
    enviador.enviar(MENSAJE)

    assert enviador.enviados == [MENSAJE]

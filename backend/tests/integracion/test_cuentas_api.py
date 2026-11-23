"""Cuentas de punta a punta contra PostgreSQL real (CU-01, CU-02, CU-03, CU-11, RN-09)."""

import re
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.correo import EnviadorEnMemoria

VECINA: dict[str, Any] = {
    "dni": "30.123.456",
    "nombre": "Ana",
    "apellido": "Pérez",
    "email": "Ana.Perez@Ejemplo.com",
    "password": "una-clave-segura",
    "acepta_terminos": True,
}


def token_del_ultimo_email(correos: EnviadorEnMemoria, ruta: str) -> str:
    coincidencia = re.search(rf"{ruta}\?token=([\w-]+)", correos.enviados[-1].texto)
    assert coincidencia, correos.enviados[-1].texto
    return coincidencia.group(1)


def registrar_y_verificar(cliente: TestClient, correos: EnviadorEnMemoria) -> None:
    assert cliente.post("/auth/registro", json=VECINA).status_code == 201
    token = token_del_ultimo_email(correos, "/verificar")
    assert cliente.post("/auth/verificar", json={"token": token}).status_code == 200
    cliente.post("/auth/salir")


def test_cu01_cu02_registro_verificacion_y_sesion(
    cliente: TestClient, correos: EnviadorEnMemoria, base_limpia: Engine
) -> None:
    respuesta = cliente.post("/auth/registro", json=VECINA)

    assert respuesta.status_code == 201
    (mensaje,) = correos.enviados
    assert mensaje.para == "ana.perez@ejemplo.com"
    with base_limpia.connect() as c:
        fila = c.execute(text("SELECT dni, email_verificado_en, rol FROM usuario")).one()
        hashes = c.execute(text("SELECT hash FROM token")).scalars().all()
    assert fila == ("30123456", None, "vecino")
    token = token_del_ultimo_email(correos, "/verificar")
    assert token not in hashes  # se guarda el hash, nunca el token

    assert cliente.get("/auth/yo").status_code == 401
    verificado = cliente.post("/auth/verificar", json={"token": token})

    assert verificado.status_code == 200
    assert verificado.json()["email_verificado"] is True
    assert "httponly" in verificado.headers["set-cookie"].lower()
    assert "samesite=lax" in verificado.headers["set-cookie"].lower()
    yo = cliente.get("/auth/yo").json()
    assert yo["email"] == "ana.perez@ejemplo.com"
    assert "dni" not in yo  # RNF-08


def test_cu02_el_enlace_es_de_un_solo_uso(cliente: TestClient, correos: EnviadorEnMemoria) -> None:
    cliente.post("/auth/registro", json=VECINA)
    token = token_del_ultimo_email(correos, "/verificar")

    assert cliente.post("/auth/verificar", json={"token": token}).status_code == 200
    segunda = cliente.post("/auth/verificar", json={"token": token})

    assert segunda.status_code == 400
    assert "venció o ya se usó" in segunda.json()["detail"]


def test_cu02_el_enlace_vence_a_las_24_horas(
    cliente: TestClient, correos: EnviadorEnMemoria, base_limpia: Engine
) -> None:
    cliente.post("/auth/registro", json=VECINA)
    token = token_del_ultimo_email(correos, "/verificar")
    with base_limpia.begin() as c:
        c.execute(text("UPDATE token SET expira_en = now() - interval '1 minute'"))

    assert cliente.post("/auth/verificar", json={"token": token}).status_code == 400


def test_cu02_reenviar_invalida_el_enlace_anterior(
    cliente: TestClient, correos: EnviadorEnMemoria
) -> None:
    cliente.post("/auth/registro", json=VECINA)
    viejo = token_del_ultimo_email(correos, "/verificar")

    respuesta = cliente.post("/auth/reenviar-verificacion", json={"email": VECINA["email"]})
    nuevo = token_del_ultimo_email(correos, "/verificar")

    assert respuesta.status_code == 202
    assert cliente.post("/auth/verificar", json={"token": viejo}).status_code == 400
    assert cliente.post("/auth/verificar", json={"token": nuevo}).status_code == 200


@pytest.mark.parametrize(
    "cambio",
    [{"email": "otra@ejemplo.com"}, {"dni": "99888777"}],
    ids=["mismo-dni", "mismo-email"],
)
def test_cu01_dni_o_email_repetido_sin_revelar_cual(
    cliente: TestClient, cambio: dict[str, str]
) -> None:
    cliente.post("/auth/registro", json=VECINA)

    respuesta = cliente.post("/auth/registro", json=VECINA | cambio)

    assert respuesta.status_code == 409
    assert "DNI o ese email" in respuesta.json()["detail"]


@pytest.mark.parametrize(
    "cambio",
    [
        {"dni": "123456"},
        {"dni": "12A45678"},
        {"email": "no-es-un-email"},
        {"password": "corta"},
        {"acepta_terminos": False},
        {"nombre": "   "},
    ],
)
def test_cu01_formato_invalido_responde_422(cliente: TestClient, cambio: dict[str, Any]) -> None:
    assert cliente.post("/auth/registro", json=VECINA | cambio).status_code == 422


def test_rn09_la_base_rechaza_un_dni_invalido_aunque_se_saltee_la_api(base_limpia: Engine) -> None:
    with pytest.raises(Exception, match="ck_usuario_dni_formato"), base_limpia.begin() as c:
        c.execute(
            text(
                "INSERT INTO usuario (dni, nombre, apellido, email, password_hash,"
                " acepto_terminos_en) VALUES ('123', 'a', 'b', 'c@d.com', 'x', now())"
            )
        )


@pytest.mark.parametrize("identificador", ["30123456", "30.123.456", "ANA.PEREZ@ejemplo.com"])
def test_cu03_ingreso_con_dni_o_email(
    cliente: TestClient, correos: EnviadorEnMemoria, identificador: str
) -> None:
    registrar_y_verificar(cliente, correos)

    respuesta = cliente.post(
        "/auth/ingreso", json={"identificador": identificador, "password": VECINA["password"]}
    )

    assert respuesta.status_code == 200
    assert cliente.get("/auth/yo").status_code == 200


def test_cu03_credenciales_incorrectas_con_mensaje_generico(
    cliente: TestClient, correos: EnviadorEnMemoria
) -> None:
    registrar_y_verificar(cliente, correos)

    mala_clave = cliente.post(
        "/auth/ingreso", json={"identificador": "30123456", "password": "incorrecta"}
    )
    no_existe = cliente.post(
        "/auth/ingreso", json={"identificador": "11222333", "password": "incorrecta"}
    )

    assert mala_clave.status_code == no_existe.status_code == 401
    assert mala_clave.json() == no_existe.json()


def test_cu03_sin_verificar_no_entra(cliente: TestClient) -> None:
    cliente.post("/auth/registro", json=VECINA)

    respuesta = cliente.post(
        "/auth/ingreso", json={"identificador": "30123456", "password": VECINA["password"]}
    )

    assert respuesta.status_code == 403
    assert "confirmaste tu email" in respuesta.json()["detail"]
    assert cliente.get("/auth/yo").status_code == 401


def test_cu03_cinco_intentos_fallidos_bloquean_la_cuenta(
    cliente: TestClient, correos: EnviadorEnMemoria
) -> None:
    registrar_y_verificar(cliente, correos)
    mala = {"identificador": "30123456", "password": "incorrecta"}

    codigos = [cliente.post("/auth/ingreso", json=mala).status_code for _ in range(5)]
    con_la_clave_buena = cliente.post(
        "/auth/ingreso", json={"identificador": "30123456", "password": VECINA["password"]}
    )

    assert codigos == [401] * 5
    assert con_la_clave_buena.status_code == 429
    assert "15 minutos" in con_la_clave_buena.json()["detail"]


def test_cu03_salir_cierra_la_sesion(cliente: TestClient, correos: EnviadorEnMemoria) -> None:
    registrar_y_verificar(cliente, correos)
    cliente.post(
        "/auth/ingreso", json={"identificador": "30123456", "password": VECINA["password"]}
    )

    assert cliente.post("/auth/salir").status_code == 204
    assert cliente.get("/auth/yo").status_code == 401


def test_cu11_recuperar_no_revela_si_la_cuenta_existe(
    cliente: TestClient, correos: EnviadorEnMemoria
) -> None:
    registrar_y_verificar(cliente, correos)
    antes = len(correos.enviados)

    existe = cliente.post("/auth/recuperar", json={"email": VECINA["email"]})
    no_existe = cliente.post("/auth/recuperar", json={"email": "nadie@ejemplo.com"})

    assert existe.status_code == no_existe.status_code == 202
    assert existe.json() == no_existe.json()
    assert len(correos.enviados) == antes + 1


def test_cu11_restablecer_cambia_la_clave_y_cierra_las_otras_sesiones(
    cliente: TestClient, correos: EnviadorEnMemoria
) -> None:
    registrar_y_verificar(cliente, correos)
    credenciales = {"identificador": "30123456", "password": VECINA["password"]}
    with TestClient(cliente.app) as otro_dispositivo:
        assert otro_dispositivo.post("/auth/ingreso", json=credenciales).status_code == 200

        cliente.post("/auth/recuperar", json={"email": VECINA["email"]})
        token = token_del_ultimo_email(correos, "/restablecer")
        respuesta = cliente.post(
            "/auth/restablecer", json={"token": token, "password": "otra-clave-nueva"}
        )

        assert respuesta.status_code == 200
        assert otro_dispositivo.get("/auth/yo").status_code == 401  # sesión vieja, afuera

    assert cliente.post("/auth/ingreso", json=credenciales).status_code == 401
    nueva = credenciales | {"password": "otra-clave-nueva"}
    assert cliente.post("/auth/ingreso", json=nueva).status_code == 200


def test_cu11_el_enlace_de_recuperacion_no_sirve_para_verificar(
    cliente: TestClient, correos: EnviadorEnMemoria
) -> None:
    registrar_y_verificar(cliente, correos)
    cliente.post("/auth/recuperar", json={"email": VECINA["email"]})
    token = token_del_ultimo_email(correos, "/restablecer")

    assert cliente.post("/auth/verificar", json={"token": token}).status_code == 400

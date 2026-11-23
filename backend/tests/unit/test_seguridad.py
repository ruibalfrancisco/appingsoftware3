from datetime import UTC, datetime, timedelta

import pytest

from app.seguridad import (
    DatosSesion,
    SesionInvalidaError,
    crear_jwt,
    generar_token_de_enlace,
    hash_de_token,
    hashear_password,
    leer_jwt,
    necesita_rehash,
    verificar_password,
)

SECRETO = "s" * 32


def test_rnf07_las_contraseñas_se_guardan_con_argon2() -> None:
    hash_ = hashear_password("clave-del-vecino")

    assert hash_.startswith("$argon2id$")
    assert "clave-del-vecino" not in hash_
    assert verificar_password(hash_, "clave-del-vecino")
    assert not verificar_password(hash_, "otra-clave")
    assert not necesita_rehash(hash_)


def test_un_hash_corrupto_no_valida_nada() -> None:
    assert not verificar_password("no-es-un-hash", "clave")


def test_la_sesion_viaja_firmada_con_usuario_y_version() -> None:
    ahora = datetime.now(UTC)
    token = crear_jwt(DatosSesion(42, 3), SECRETO, timedelta(days=7), ahora)

    assert leer_jwt(token, SECRETO) == DatosSesion(42, 3)


@pytest.mark.parametrize(
    ("secreto_al_leer", "creado_hace"),
    [
        ("otro-secreto-" + "x" * 32, timedelta(0)),  # firmada con otra clave
        (SECRETO, timedelta(days=8)),  # vencida
    ],
)
def test_sesiones_invalidas(secreto_al_leer: str, creado_hace: timedelta) -> None:
    momento = datetime.now(UTC) - creado_hace
    token = crear_jwt(DatosSesion(1, 0), SECRETO, timedelta(days=7), momento)

    with pytest.raises(SesionInvalidaError):
        leer_jwt(token, secreto_al_leer)


def test_una_sesion_adulterada_no_sirve() -> None:
    token = crear_jwt(DatosSesion(1, 0), SECRETO, timedelta(days=7), datetime.now(UTC))

    with pytest.raises(SesionInvalidaError):
        leer_jwt(token[:-4] + "AAAA", SECRETO)


def test_el_token_del_enlace_no_se_guarda_solo_su_hash() -> None:
    token, hash_ = generar_token_de_enlace()

    assert len(token) >= 40
    assert hash_ == hash_de_token(token)
    assert token not in hash_
    assert generar_token_de_enlace()[0] != token

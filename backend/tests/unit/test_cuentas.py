from datetime import UTC, datetime, timedelta

import pytest

from app.dominio.cuentas import (
    DURACION_BLOQUEO,
    EstadoIntentos,
    PasswordInvalidaError,
    esta_bloqueado,
    normalizar_email,
    registrar_exito,
    registrar_fallo,
    token_vigente,
    validar_password,
)

AHORA = datetime(2026, 11, 22, 12, 0, tzinfo=UTC)


@pytest.mark.parametrize("password", ["12345678", "una frase larga y segura", "x" * 128])
def test_cu01_acepta_contraseñas_de_8_a_128_caracteres(password: str) -> None:
    assert validar_password(password) == password


@pytest.mark.parametrize("password", ["", "1234567", "x" * 129, " " * 10])
def test_cu01_rechaza_contraseñas_cortas_largas_o_vacias(password: str) -> None:
    with pytest.raises(PasswordInvalidaError):
        validar_password(password)


def test_el_email_se_guarda_en_minusculas_y_sin_espacios() -> None:
    assert normalizar_email("  Vecina@Ejemplo.COM ") == "vecina@ejemplo.com"


def test_cu02_el_enlace_sirve_antes_de_vencer_y_una_sola_vez() -> None:
    vence = AHORA + timedelta(hours=1)
    assert token_vigente(vence, None, AHORA)
    assert not token_vigente(vence, AHORA, AHORA)  # ya usado
    assert not token_vigente(AHORA, None, AHORA)  # vence justo ahora
    assert not token_vigente(AHORA - timedelta(seconds=1), None, AHORA)


def fallar(veces: int, desde: datetime, cada: timedelta) -> EstadoIntentos:
    estado = EstadoIntentos()
    for i in range(veces):
        estado = registrar_fallo(estado, desde + i * cada)
    return estado


def test_cu03_cuatro_fallos_no_bloquean() -> None:
    estado = fallar(4, AHORA, timedelta(minutes=1))
    assert estado.intentos_fallidos == 4
    assert not esta_bloqueado(estado, AHORA + timedelta(minutes=4))


def test_cu03_cinco_fallos_en_15_minutos_bloquean_15_minutos() -> None:
    estado = fallar(5, AHORA, timedelta(minutes=2))
    quinto = AHORA + timedelta(minutes=8)
    assert estado.bloqueado_hasta == quinto + DURACION_BLOQUEO
    assert esta_bloqueado(estado, quinto + timedelta(minutes=14))
    assert not esta_bloqueado(estado, quinto + DURACION_BLOQUEO)


def test_cu03_los_fallos_viejos_no_cuentan() -> None:
    estado = fallar(4, AHORA, timedelta(minutes=1))
    estado = registrar_fallo(estado, AHORA + timedelta(minutes=30))
    assert estado.intentos_fallidos == 1
    assert estado.bloqueado_hasta is None


def test_cu03_un_ingreso_correcto_reinicia_los_intentos() -> None:
    assert registrar_exito() == EstadoIntentos()

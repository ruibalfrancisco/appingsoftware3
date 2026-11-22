import pytest

from app.dominio.identidad import DniInvalidoError, normalizar_dni


@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [
        ("1234567", "1234567"),  # 7 dígitos
        ("12345678", "12345678"),  # 8 dígitos
        ("12.345.678", "12345678"),  # con puntos
        (" 1.234.567 ", "1234567"),  # con espacios
    ],
)
def test_ut07_dni_valido(entrada: str, esperado: str) -> None:
    assert normalizar_dni(entrada) == esperado


@pytest.mark.parametrize(
    "entrada",
    [
        "123456",  # 6 dígitos
        "123456789",  # 9 dígitos
        "12A45678",  # con letras
        "12-345-678",  # otros separadores
        "",
    ],
)
def test_ut07_dni_invalido(entrada: str) -> None:
    with pytest.raises(DniInvalidoError):
        normalizar_dni(entrada)

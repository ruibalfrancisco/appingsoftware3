import pytest

from app.dominio.gravedad import GravedadInvalidaError, etiqueta_gravedad, validar_gravedad


@pytest.mark.parametrize("valor", [1, 5, 10])
def test_acepta_enteros_del_1_al_10(valor: int) -> None:
    assert validar_gravedad(valor) == valor


@pytest.mark.parametrize("valor", [0, 11, -3, 5.5, "7", None, True])
def test_ut04_rechaza_fuera_de_rango_decimales_y_otros_tipos(valor: object) -> None:
    with pytest.raises(GravedadInvalidaError):
        validar_gravedad(valor)


@pytest.mark.parametrize(
    ("valor", "etiqueta"),
    [(1, "Leve"), (3, "Leve"), (4, "Moderado"), (6, "Moderado"), (7, "Grave"), (8, "Grave"),
     (9, "Urgente"), (10, "Urgente")],
)  # fmt: skip
def test_etiquetas(valor: int, etiqueta: str) -> None:
    assert etiqueta_gravedad(valor) == etiqueta

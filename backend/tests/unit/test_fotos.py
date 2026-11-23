import io

import pytest
from PIL import Image

from app.fotos import MAX_BYTES, FotoInvalidaError, procesar_foto


def imagen(
    ancho: int = 400,
    alto: int = 300,
    formato: str = "JPEG",
    modo: str = "RGB",
    exif: Image.Exif | None = None,
) -> bytes:
    salida = io.BytesIO()
    color = (200, 50, 50, 0) if modo == "RGBA" else (200, 50, 50)
    opciones = {"exif": exif} if exif is not None else {}
    Image.new(modo, (ancho, alto), color).save(salida, format=formato, **opciones)
    return salida.getvalue()


def abrir(datos: bytes) -> Image.Image:
    return Image.open(io.BytesIO(datos))


def test_rn10_la_foto_se_guarda_sin_metadatos_exif() -> None:
    exif = Image.Exif()
    exif[0x010F] = "Fabricante del celular"  # Make
    exif[0x0110] = "Modelo secreto"  # Model
    original = imagen(exif=exif)
    assert b"Modelo secreto" in original

    procesada = procesar_foto(original)

    assert b"Modelo secreto" not in procesada.contenido
    assert len(abrir(procesada.contenido).getexif()) == 0
    assert procesada.tipo_mime == "image/jpeg"


def test_rn10_se_achica_a_1600_px_de_lado_mayor() -> None:
    procesada = procesar_foto(imagen(4000, 3000))

    assert (procesada.ancho, procesada.alto) == (1600, 1200)
    assert abrir(procesada.contenido).size == (1600, 1200)


def test_una_foto_chica_no_se_agranda() -> None:
    assert procesar_foto(imagen(800, 600)).ancho == 800


def test_se_endereza_segun_la_orientacion_de_la_camara() -> None:
    exif = Image.Exif()
    exif[0x0112] = 6  # Orientation: rotada 90° (foto vertical sacada con el celular)

    procesada = procesar_foto(imagen(400, 300, exif=exif))

    assert (procesada.ancho, procesada.alto) == (300, 400)


@pytest.mark.parametrize("formato", ["PNG", "WEBP"])
def test_png_y_webp_se_convierten_a_jpeg(formato: str) -> None:
    procesada = procesar_foto(imagen(formato=formato, modo="RGBA"))

    convertida = abrir(procesada.contenido)
    assert convertida.format == "JPEG"
    # La transparencia queda sobre fondo blanco, no negro.
    assert convertida.convert("RGB").getpixel((0, 0)) == pytest.approx((255, 255, 255), abs=3)


@pytest.mark.parametrize(
    ("datos", "mensaje"),
    [
        (b"esto no es una imagen", "No pudimos leer"),
        (imagen(formato="GIF", modo="P"), "JPG, PNG o WEBP"),
        (b"\xff" * (MAX_BYTES + 1), "10 MB"),
    ],
    ids=["texto", "gif", "muy-pesada"],
)
def test_rn10_rechaza_lo_que_no_es_una_foto_valida(datos: bytes, mensaje: str) -> None:
    with pytest.raises(FotoInvalidaError, match=mensaje):
        procesar_foto(datos)

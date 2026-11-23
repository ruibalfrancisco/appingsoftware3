"""RN-10 Foto: JPG, PNG o WEBP de hasta 10 MB.

El backend no confía en lo que manda el navegador: abre la imagen, la endereza según la
orientación de la cámara, la achica a 1600 px de lado mayor y la vuelve a codificar como JPEG
**sin metadatos** (el EXIF puede traer la ubicación exacta del celular, RNF-08).
"""

import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 10 * 1024 * 1024
LADO_MAXIMO = 1600
FORMATOS_ACEPTADOS = {"JPEG", "PNG", "WEBP"}
# Defensa contra "bombas de descompresión": una imagen chica que se expande a gigapíxeles.
Image.MAX_IMAGE_PIXELS = 50_000_000


class FotoInvalidaError(ValueError):
    pass


@dataclass(frozen=True)
class FotoProcesada:
    contenido: bytes
    ancho: int
    alto: int
    tipo_mime: str = "image/jpeg"


def procesar_foto(datos: bytes) -> FotoProcesada:
    if len(datos) > MAX_BYTES:
        raise FotoInvalidaError("La foto puede pesar hasta 10 MB")
    try:
        with Image.open(io.BytesIO(datos)) as original:
            if original.format not in FORMATOS_ACEPTADOS:
                raise FotoInvalidaError("La foto tiene que ser JPG, PNG o WEBP")
            imagen = ImageOps.exif_transpose(original)
            imagen.thumbnail((LADO_MAXIMO, LADO_MAXIMO))
            if imagen.mode != "RGB":
                # PNG o WEBP con transparencia: fondo blanco en lugar de negro.
                fondo = Image.new("RGB", imagen.size, "white")
                con_alfa = imagen.convert("RGBA")
                fondo.paste(con_alfa, mask=con_alfa.getchannel("A"))
                imagen = fondo
            salida = io.BytesIO()
            # Sin exif= ni icc_profile=: el JPEG nuevo no lleva metadatos.
            imagen.save(salida, format="JPEG", quality=85, optimize=True)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as error:
        raise FotoInvalidaError("No pudimos leer la foto. Probá con otra.") from error
    return FotoProcesada(salida.getvalue(), imagen.width, imagen.height)

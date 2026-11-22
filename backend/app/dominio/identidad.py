"""RN-09 Identidad: DNI de 7 u 8 dígitos.

Se aceptan puntos y espacios porque así se escribe el DNI en Argentina (12.345.678),
y se guarda solo con dígitos.
"""

import re

_DNI = re.compile(r"\d{7,8}")


class DniInvalidoError(ValueError):
    pass


def normalizar_dni(texto: str) -> str:
    limpio = texto.replace(".", "").replace(" ", "").strip()
    if not _DNI.fullmatch(limpio):
        raise DniInvalidoError("El DNI tiene que tener 7 u 8 dígitos")
    return limpio

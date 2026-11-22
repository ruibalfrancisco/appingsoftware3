"""Versión y commit que están corriendo (RNF-09: /health dice siempre qué versión hay desplegada).

El pipeline de despliegue escribe `build_info.json` antes de subir el código a Railway.
En local ese archivo no existe y se usan valores de desarrollo.
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

RUTA_BUILD_INFO = Path(__file__).resolve().parent.parent / "build_info.json"


@dataclass(frozen=True)
class BuildInfo:
    version: str
    commit: str


@lru_cache
def obtener_build_info(ruta: Path = RUTA_BUILD_INFO) -> BuildInfo:
    try:
        datos = json.loads(ruta.read_text(encoding="utf-8"))
        return BuildInfo(version=str(datos["version"]), commit=str(datos["commit"]))
    except (FileNotFoundError, KeyError, ValueError):
        return BuildInfo(version="0.0.0-dev", commit="local")

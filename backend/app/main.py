from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.build_info import obtener_build_info
from app.config import obtener_settings
from app.rutas import apoyos, cuentas, gestion, reclamos

settings = obtener_settings()
build_info = obtener_build_info()

app = FastAPI(title="Reclamos Villa Allende API", version=build_info.version)
app.include_router(cuentas.router)
# apoyos va antes que reclamos: /reclamos/similares no tiene que caer en /reclamos/{id}.
app.include_router(apoyos.router)
app.include_router(reclamos.router)
app.include_router(gestion.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.lista_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


class Salud(BaseModel):
    status: Literal["ok"]
    version: str
    commit: str
    ambiente: str


@app.get("/health", tags=["sistema"])
def health() -> Salud:
    """Lo usan el healthcheck de Railway y el smoke test después de cada despliegue."""
    return Salud(
        status="ok",
        version=build_info.version,
        commit=build_info.commit,
        ambiente=settings.railway_environment_name,
    )

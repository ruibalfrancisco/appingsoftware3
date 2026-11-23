"""Conexión a PostgreSQL. El motor se crea la primera vez que se usa, no al importar."""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import obtener_settings


@lru_cache
def obtener_motor() -> Engine:
    return create_engine(obtener_settings().sqlalchemy_database_url, pool_pre_ping=True)


@lru_cache
def _fabrica_de_sesiones() -> sessionmaker[Session]:
    return sessionmaker(bind=obtener_motor(), expire_on_commit=False)


def obtener_sesion_db() -> Iterator[Session]:
    """Dependencia de FastAPI: una sesión por pedido, que se cierra al terminar."""
    with _fabrica_de_sesiones()() as sesion:
        yield sesion

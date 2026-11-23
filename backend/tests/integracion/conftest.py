"""Las pruebas de integración corren contra PostgreSQL + PostGIS real.

En CI la base la levanta un contenedor de servicio; en local, `docker compose -f
infra/docker-compose.yml up -d`. Si no hay DATABASE_URL, se saltean en vez de fallar.
"""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text

from app.config import Settings
from app.correo import EnviadorEnMemoria, obtener_enviador
from app.main import app

RAIZ_BACKEND = Path(__file__).resolve().parents[2]


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    carpeta = Path(__file__).resolve().parent
    for item in items:
        if carpeta not in item.path.resolve().parents:
            continue
        item.add_marker(pytest.mark.integracion)
        if not os.environ.get("DATABASE_URL"):
            item.add_marker(pytest.mark.skip(reason="Falta DATABASE_URL con PostGIS"))


@pytest.fixture(scope="session")
def url_base() -> str:
    return Settings().sqlalchemy_database_url


@pytest.fixture(scope="session")
def motor(url_base: str) -> Iterator[Engine]:
    motor = create_engine(url_base)
    yield motor
    motor.dispose()


@pytest.fixture
def config_alembic(url_base: str) -> Config:
    config = Config(str(RAIZ_BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(RAIZ_BACKEND / "alembic"))
    config.set_main_option("sqlalchemy.url", url_base.replace("%", "%%"))
    return config


@pytest.fixture
def base_limpia(config_alembic: Config, motor: Engine) -> Engine:
    """Esquema al día y tablas vacías: cada prueba crea sus propios datos."""
    command.upgrade(config_alembic, "head")
    with motor.begin() as conexion:
        conexion.execute(text("TRUNCATE usuario, token RESTART IDENTITY CASCADE"))
    return motor


@pytest.fixture
def correos() -> EnviadorEnMemoria:
    return EnviadorEnMemoria()


@pytest.fixture
def cliente(base_limpia: Engine, correos: EnviadorEnMemoria) -> Iterator[TestClient]:
    app.dependency_overrides[obtener_enviador] = lambda: correos
    with TestClient(app) as cliente:
        yield cliente
    app.dependency_overrides.clear()

"""Las pruebas de integración corren contra PostgreSQL + PostGIS real.

En CI la base la levanta un contenedor de servicio; en local, `docker compose -f
infra/docker-compose.yml up -d`. Si no hay DATABASE_URL, se saltean en vez de fallar.
"""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import Engine, create_engine

from app.config import Settings

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

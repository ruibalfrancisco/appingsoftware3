"""Entorno de Alembic.

La URL de la base sale de DATABASE_URL (la misma configuración que usa la API), así el
comando `alembic upgrade head` funciona igual en local, en CI y como pre-deploy en Railway.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.config import obtener_settings
from app.modelos import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# MetaData de los modelos: permite --autogenerate y `alembic check` (modelos = migraciones).
target_metadata = Base.metadata

# Tablas que crea la extensión PostGIS en el esquema public: no son nuestras.
TABLAS_AJENAS = {"spatial_ref_sys"}


def incluir_nombre(nombre: str | None, tipo: str, _padres: object) -> bool:
    return not (tipo == "table" and nombre in TABLAS_AJENAS)


def url_de_la_base() -> str:
    # Una URL pasada por código (por ejemplo, desde las pruebas) tiene prioridad.
    return config.get_main_option("sqlalchemy.url") or obtener_settings().sqlalchemy_database_url


def run_migrations_offline() -> None:
    context.configure(
        url=url_de_la_base(),
        target_metadata=target_metadata,
        include_name=incluir_nombre,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    motor = create_engine(url_de_la_base(), poolclass=pool.NullPool)
    with motor.connect() as conexion:
        context.configure(
            connection=conexion, target_metadata=target_metadata, include_name=incluir_nombre
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, text


def revision_actual(motor: Engine) -> str | None:
    with motor.connect() as conexion:
        return MigrationContext.configure(conexion).get_current_revision()


def postgis_activo(motor: Engine) -> bool:
    with motor.connect() as conexion:
        fila = conexion.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'postgis'"))
        return fila.first() is not None


def test_it10_las_migraciones_suben_y_bajan_sin_errores(
    config_alembic: Config, motor: Engine
) -> None:
    head = ScriptDirectory.from_config(config_alembic).get_current_head()

    command.upgrade(config_alembic, "head")
    assert revision_actual(motor) == head
    assert postgis_activo(motor)

    command.downgrade(config_alembic, "base")
    assert revision_actual(motor) is None

    command.upgrade(config_alembic, "head")
    assert revision_actual(motor) == head


def test_postgis_calcula_distancias_en_metros(config_alembic: Config, motor: Engine) -> None:
    command.upgrade(config_alembic, "head")
    # Dos puntos de Villa Allende separados ~111 m en latitud.
    consulta = text(
        "SELECT ST_Distance("
        "  ST_GeogFromText('POINT(-64.2950 -31.2940)'),"
        "  ST_GeogFromText('POINT(-64.2950 -31.2950)'))"
    )
    with motor.connect() as conexion:
        distancia = conexion.execute(consulta).scalar_one()
    assert 105 < distancia < 115


def test_los_modelos_coinciden_con_las_migraciones(config_alembic: Config) -> None:
    """Si alguien cambia un modelo y se olvida la migración, esto falla."""
    command.upgrade(config_alembic, "head")
    command.check(config_alembic)

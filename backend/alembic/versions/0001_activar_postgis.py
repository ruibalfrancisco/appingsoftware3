"""Activar PostGIS.

"A 50 m" (RN-01) y "dentro del ejido" (RN-06) se resuelven con funciones espaciales de
PostGIS, así que la extensión tiene que existir antes que cualquier tabla.

Revision ID: 0001
Revises:
Create Date: 2026-11-22
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")


def downgrade() -> None:
    # A propósito no se borra la extensión: es infraestructura compartida (la imagen de
    # PostGIS y la plantilla de Railway crean otras extensiones que dependen de ella) y
    # borrarla en producción se llevaría puestas todas las columnas geográficas.
    pass

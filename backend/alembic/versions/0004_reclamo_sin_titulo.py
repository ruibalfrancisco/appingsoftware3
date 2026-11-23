"""El reclamo ya no tiene título: se lo nombra por su tipo y su dirección.

El vecino elige el tipo y describe el problema; pedirle además un título era repetir lo mismo.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("reclamo", "titulo")


def downgrade() -> None:
    # Al volver atrás, cada reclamo recupera como título el nombre de su tipo.
    op.add_column("reclamo", sa.Column("titulo", sa.String(80), nullable=True))
    op.execute(
        "UPDATE reclamo SET titulo = tipo_reclamo.nombre"
        " FROM tipo_reclamo WHERE tipo_reclamo.id = reclamo.tipo_id"
    )
    op.alter_column("reclamo", "titulo", nullable=False)

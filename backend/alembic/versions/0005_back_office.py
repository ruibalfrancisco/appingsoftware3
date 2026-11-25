"""Back office: novedades por cambio de estado (RN-07) e índice del Tablero (etapa 5).

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notificacion",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("reclamo_id", sa.Integer(), nullable=False),
        sa.Column("historial_id", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(20), server_default="cambio_estado", nullable=False),
        sa.Column("leida_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_notificacion"),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuario.id"],
            name="fk_notificacion_usuario_id_usuario",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reclamo_id"],
            ["reclamo.id"],
            name="fk_notificacion_reclamo_id_reclamo",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["historial_id"],
            ["historial_estado.id"],
            name="fk_notificacion_historial_id_historial_estado",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("tipo IN ('cambio_estado')", name="ck_notificacion_tipo_valido"),
    )
    op.create_index("ix_notificacion_usuario_leida", "notificacion", ["usuario_id", "leida_en"])
    op.create_index("ix_reclamo_estado_prioridad", "reclamo", ["estado", "prioridad", "creado_en"])


def downgrade() -> None:
    op.drop_index("ix_reclamo_estado_prioridad", table_name="reclamo")
    op.drop_index("ix_notificacion_usuario_leida", table_name="notificacion")
    op.drop_table("notificacion")

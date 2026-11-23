"""Usuarios y tokens de un solo uso (etapa 2: cuentas).

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-22
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

FECHA = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "usuario",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("dni", sa.String(8), nullable=False),
        sa.Column("nombre", sa.String(80), nullable=False),
        sa.Column("apellido", sa.String(80), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("rol", sa.String(10), server_default="vecino", nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("email_verificado_en", FECHA, nullable=True),
        sa.Column("acepto_terminos_en", FECHA, nullable=False),
        sa.Column("intentos_fallidos", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("ultimo_fallo_en", FECHA, nullable=True),
        sa.Column("bloqueado_hasta", FECHA, nullable=True),
        sa.Column("version_sesion", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("creado_en", FECHA, server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_usuario"),
        sa.UniqueConstraint("dni", name="uq_usuario_dni"),
        sa.UniqueConstraint("email", name="uq_usuario_email"),
        sa.CheckConstraint("dni ~ '^[0-9]{7,8}$'", name="ck_usuario_dni_formato"),
        sa.CheckConstraint("rol IN ('vecino', 'operador', 'admin')", name="ck_usuario_rol_valido"),
        sa.CheckConstraint("email = lower(email)", name="ck_usuario_email_en_minusculas"),
    )
    op.create_table(
        "token",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("proposito", sa.String(12), nullable=False),
        sa.Column("hash", sa.String(64), nullable=False),
        sa.Column("expira_en", FECHA, nullable=False),
        sa.Column("usado_en", FECHA, nullable=True),
        sa.Column("creado_en", FECHA, server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_token"),
        sa.ForeignKeyConstraint(
            ["usuario_id"], ["usuario.id"], name="fk_token_usuario_id_usuario", ondelete="CASCADE"
        ),
        sa.UniqueConstraint("hash", name="uq_token_hash"),
        sa.CheckConstraint(
            "proposito IN ('verificacion', 'recuperacion', 'invitacion')",
            name="ck_token_proposito_valido",
        ),
    )
    op.create_index("ix_token_usuario_id", "token", ["usuario_id"])


def downgrade() -> None:
    op.drop_index("ix_token_usuario_id", table_name="token")
    op.drop_table("token")
    op.drop_table("usuario")

"""Reclamos, apoyos, fotos e historial, con tipos y áreas semilla (etapa 3).

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geography

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

FECHA = sa.DateTime(timezone=True)
ESTADOS = "('PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'RESUELTO', 'RECHAZADO')"

# Íconos de Lucide; colores con contraste de 4,5:1 o más sobre blanco (RNF-06).
TIPOS = [
    {"codigo": "bache", "nombre": "Bache", "icono": "construction", "color": "#B45309"},
    {"codigo": "luminaria", "nombre": "Luminaria rota", "icono": "lightbulb-off", "color": "#7C3AED"},
    {"codigo": "senalizacion", "nombre": "Señalización deficiente", "icono": "signpost", "color": "#0369A1"},
    {"codigo": "basura", "nombre": "Basura o microbasural", "icono": "trash-2", "color": "#4D7C0F"},
    {"codigo": "semaforo", "nombre": "Semáforo roto", "icono": "traffic-cone", "color": "#BE123C"},
    {"codigo": "otro", "nombre": "Otro", "icono": "circle-help", "color": "#475569"},
]  # fmt: skip

AREAS = ["Alumbrado", "Obras Públicas", "Tránsito", "Higiene Urbana"]


def upgrade() -> None:
    tipo_reclamo = op.create_table(
        "tipo_reclamo",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("codigo", sa.String(20), nullable=False),
        sa.Column("nombre", sa.String(40), nullable=False),
        sa.Column("icono", sa.String(30), nullable=False),
        sa.Column("color", sa.String(7), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_tipo_reclamo"),
        sa.UniqueConstraint("codigo", name="uq_tipo_reclamo_codigo"),
    )
    area = op.create_table(
        "area",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(40), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_area"),
        sa.UniqueConstraint("nombre", name="uq_area_nombre"),
    )
    op.create_table(
        "reclamo",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("tipo_id", sa.Integer(), nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=True),
        sa.Column("titulo", sa.String(80), nullable=False),
        sa.Column("descripcion", sa.String(500), nullable=False),
        sa.Column("direccion", sa.String(200), nullable=True),
        sa.Column(
            "ubicacion",
            Geography(geometry_type="POINT", srid=4326, spatial_index=False),
            nullable=False,
        ),
        sa.Column("estado", sa.String(12), server_default="PENDIENTE", nullable=False),
        sa.Column("cantidad_apoyos", sa.Integer(), nullable=False),
        sa.Column("gravedad_promedio", sa.Float(), nullable=False),
        sa.Column("prioridad", sa.Float(), nullable=False),
        sa.Column("creado_en", FECHA, server_default=sa.func.now(), nullable=False),
        sa.Column("actualizado_en", FECHA, server_default=sa.func.now(), nullable=False),
        sa.Column("cerrado_en", FECHA, nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_reclamo"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuario.id"], name="fk_reclamo_usuario_id_usuario"),
        sa.ForeignKeyConstraint(["tipo_id"], ["tipo_reclamo.id"], name="fk_reclamo_tipo_id_tipo_reclamo"),
        sa.ForeignKeyConstraint(["area_id"], ["area.id"], name="fk_reclamo_area_id_area"),
        sa.CheckConstraint(f"estado IN {ESTADOS}", name="ck_reclamo_estado_valido"),
    )  # fmt: skip
    op.create_index("ix_reclamo_ubicacion", "reclamo", ["ubicacion"], postgresql_using="gist")
    op.create_index("ix_reclamo_usuario_creado", "reclamo", ["usuario_id", "creado_en"])

    op.create_table(
        "apoyo",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("reclamo_id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("gravedad", sa.Integer(), nullable=False),
        sa.Column("es_creador", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("creado_en", FECHA, server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_apoyo"),
        sa.ForeignKeyConstraint(
            ["reclamo_id"], ["reclamo.id"], name="fk_apoyo_reclamo_id_reclamo", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuario.id"], name="fk_apoyo_usuario_id_usuario"),
        sa.UniqueConstraint("reclamo_id", "usuario_id", name="uq_apoyo_reclamo_id"),
        sa.CheckConstraint("gravedad BETWEEN 1 AND 10", name="ck_apoyo_gravedad_1_a_10"),
    )
    op.create_table(
        "foto",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("reclamo_id", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(10), nullable=False),
        sa.Column("clave_storage", sa.String(200), nullable=False),
        sa.Column("ancho", sa.Integer(), nullable=False),
        sa.Column("alto", sa.Integer(), nullable=False),
        sa.Column("creado_en", FECHA, server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_foto"),
        sa.ForeignKeyConstraint(
            ["reclamo_id"], ["reclamo.id"], name="fk_foto_reclamo_id_reclamo", ondelete="CASCADE"
        ),
        sa.CheckConstraint("tipo IN ('reporte', 'resolucion')", name="ck_foto_tipo_valido"),
    )
    op.create_index("ix_foto_reclamo_id", "foto", ["reclamo_id"])
    op.create_table(
        "historial_estado",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("reclamo_id", sa.Integer(), nullable=False),
        sa.Column("estado_anterior", sa.String(12), nullable=True),
        sa.Column("estado_nuevo", sa.String(12), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("comentario", sa.String(500), nullable=True),
        sa.Column("creado_en", FECHA, server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_historial_estado"),
        sa.ForeignKeyConstraint(
            ["reclamo_id"],
            ["reclamo.id"],
            name="fk_historial_estado_reclamo_id_reclamo",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["usuario_id"], ["usuario.id"], name="fk_historial_estado_usuario_id_usuario"
        ),
    )
    op.create_index("ix_historial_estado_reclamo_id", "historial_estado", ["reclamo_id"])

    op.bulk_insert(tipo_reclamo, TIPOS)
    op.bulk_insert(area, [{"nombre": nombre} for nombre in AREAS])


def downgrade() -> None:
    op.drop_table("historial_estado")
    op.drop_table("foto")
    op.drop_table("apoyo")
    op.drop_table("reclamo")
    op.drop_table("area")
    op.drop_table("tipo_reclamo")

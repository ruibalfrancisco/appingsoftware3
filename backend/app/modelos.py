"""Modelos de SQLAlchemy. Las reglas críticas viven también como restricciones de la base."""

from datetime import datetime

from geoalchemy2 import Geography, WKBElement
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    MetaData,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Nombres de restricciones predecibles: las migraciones de Alembic los usan tal cual.
CONVENCION_DE_NOMBRES = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=CONVENCION_DE_NOMBRES)
    # Todas las fechas con zona horaria: se guardan en UTC y se muestran en Córdoba.
    type_annotation_map = {datetime: DateTime(timezone=True)}  # noqa: RUF012 (API de SQLAlchemy)


class Usuario(Base):
    __tablename__ = "usuario"
    __table_args__ = (
        CheckConstraint("dni ~ '^[0-9]{7,8}$'", name="dni_formato"),  # RN-09
        CheckConstraint("rol IN ('vecino', 'operador', 'admin')", name="rol_valido"),
        CheckConstraint("email = lower(email)", name="email_en_minusculas"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    dni: Mapped[str] = mapped_column(String(8), unique=True)
    nombre: Mapped[str] = mapped_column(String(80))
    apellido: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    rol: Mapped[str] = mapped_column(String(10), server_default="vecino")
    activo: Mapped[bool] = mapped_column(server_default=text("true"))
    email_verificado_en: Mapped[datetime | None]
    # Constancia del consentimiento (RF-01, Ley 25.326).
    acepto_terminos_en: Mapped[datetime]
    # Bloqueo por intentos fallidos (CU-03): ver app/dominio/cuentas.py.
    intentos_fallidos: Mapped[int] = mapped_column(server_default=text("0"))
    ultimo_fallo_en: Mapped[datetime | None]
    bloqueado_hasta: Mapped[datetime | None]
    # Cambiar la contraseña la incrementa y deja inválidas las demás sesiones (CU-11).
    version_sesion: Mapped[int] = mapped_column(server_default=text("0"))
    creado_en: Mapped[datetime] = mapped_column(server_default=func.now())


class Token(Base):
    """Enlaces de un solo uso. Se guarda el hash, nunca el token."""

    __tablename__ = "token"
    __table_args__ = (
        CheckConstraint(
            "proposito IN ('verificacion', 'recuperacion', 'invitacion')", name="proposito_valido"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuario.id", ondelete="CASCADE"), index=True
    )
    proposito: Mapped[str] = mapped_column(String(12))
    hash: Mapped[str] = mapped_column(String(64), unique=True)
    expira_en: Mapped[datetime]
    usado_en: Mapped[datetime | None]
    creado_en: Mapped[datetime] = mapped_column(server_default=func.now())


ESTADOS = "('PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'RESUELTO', 'RECHAZADO')"


class TipoReclamo(Base):
    """Bache, luminaria rota, etc. Se cargan con datos semilla en la migración 0003."""

    __tablename__ = "tipo_reclamo"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True)
    nombre: Mapped[str] = mapped_column(String(40))
    icono: Mapped[str] = mapped_column(String(30))  # nombre del ícono de Lucide
    color: Mapped[str] = mapped_column(String(7))  # color del marcador en el mapa
    activo: Mapped[bool] = mapped_column(server_default=text("true"))


class Area(Base):
    """Área municipal responsable (RF-29)."""

    __tablename__ = "area"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(40), unique=True)


class Reclamo(Base):
    __tablename__ = "reclamo"
    __table_args__ = (
        CheckConstraint(f"estado IN {ESTADOS}", name="estado_valido"),  # RN-05
        # Búsqueda de similares a 50 m (RN-01) y validación espacial.
        Index("ix_reclamo_ubicacion", "ubicacion", postgresql_using="gist"),
        # RN-08: contar los reclamos del vecino en el día.
        Index("ix_reclamo_usuario_creado", "usuario_id", "creado_en"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"))
    tipo_id: Mapped[int] = mapped_column(ForeignKey("tipo_reclamo.id"))
    area_id: Mapped[int | None] = mapped_column(ForeignKey("area.id"))
    descripcion: Mapped[str] = mapped_column(String(500))
    direccion: Mapped[str | None] = mapped_column(String(200))
    # geography: las distancias de PostGIS salen en metros sobre la esfera terrestre.
    ubicacion: Mapped[WKBElement] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False)
    )
    estado: Mapped[str] = mapped_column(String(12), server_default="PENDIENTE")
    # Se guardan para ordenar rápido; se recalculan en la misma transacción que cada apoyo.
    cantidad_apoyos: Mapped[int]
    gravedad_promedio: Mapped[float]
    prioridad: Mapped[float]
    creado_en: Mapped[datetime] = mapped_column(server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(server_default=func.now())
    cerrado_en: Mapped[datetime | None]


class Apoyo(Base):
    """ "Yo también lo vi" (RN-02). El creador cuenta como primer apoyo."""

    __tablename__ = "apoyo"
    __table_args__ = (
        UniqueConstraint("reclamo_id", "usuario_id"),  # un apoyo por vecino
        CheckConstraint("gravedad BETWEEN 1 AND 10", name="gravedad_1_a_10"),  # RN-03
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    reclamo_id: Mapped[int] = mapped_column(ForeignKey("reclamo.id", ondelete="CASCADE"))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"))
    gravedad: Mapped[int]
    es_creador: Mapped[bool] = mapped_column(server_default=text("false"))
    creado_en: Mapped[datetime] = mapped_column(server_default=func.now())


class Foto(Base):
    __tablename__ = "foto"
    __table_args__ = (CheckConstraint("tipo IN ('reporte', 'resolucion')", name="tipo_valido"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    reclamo_id: Mapped[int] = mapped_column(
        ForeignKey("reclamo.id", ondelete="CASCADE"), index=True
    )
    tipo: Mapped[str] = mapped_column(String(10))
    clave_storage: Mapped[str] = mapped_column(String(200))
    ancho: Mapped[int]
    alto: Mapped[int]
    creado_en: Mapped[datetime] = mapped_column(server_default=func.now())


class HistorialEstado(Base):
    """Solo inserciones (RN-05): cada cambio de estado con usuario y fecha."""

    __tablename__ = "historial_estado"

    id: Mapped[int] = mapped_column(primary_key=True)
    reclamo_id: Mapped[int] = mapped_column(
        ForeignKey("reclamo.id", ondelete="CASCADE"), index=True
    )
    estado_anterior: Mapped[str | None] = mapped_column(String(12))
    estado_nuevo: Mapped[str] = mapped_column(String(12))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"))
    comentario: Mapped[str | None] = mapped_column(String(500))
    creado_en: Mapped[datetime] = mapped_column(server_default=func.now())

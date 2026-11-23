"""Modelos de SQLAlchemy. Las reglas críticas viven también como restricciones de la base."""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    MetaData,
    String,
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

"""Esquemas de entrada y salida de la API. Todo se valida en el backend (RNF-07)."""

from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, EmailStr, Field, StringConstraints

from app.dominio.cuentas import normalizar_email, validar_password
from app.dominio.identidad import normalizar_dni

Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Dni = Annotated[str, AfterValidator(normalizar_dni)]
Email = Annotated[EmailStr, AfterValidator(normalizar_email)]
Password = Annotated[str, AfterValidator(validar_password)]


class Registro(BaseModel):
    dni: Dni
    nombre: Texto
    apellido: Texto
    email: Email
    password: Password
    acepta_terminos: Literal[True] = Field(
        description="Aceptación de los términos y la política de privacidad (RF-01)"
    )


class Ingreso(BaseModel):
    identificador: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] = Field(
        description="DNI o email"
    )
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class TokenDeEnlace(BaseModel):
    token: Annotated[str, StringConstraints(min_length=20, max_length=100)]


class PedidoPorEmail(BaseModel):
    email: Email


class Restablecer(TokenDeEnlace):
    password: Password


class UsuarioPropio(BaseModel):
    """Datos del propio usuario. Nunca se devuelven datos de otros (RNF-08)."""

    id: int
    nombre: str
    apellido: str
    email: str
    rol: str
    email_verificado: bool


class Aviso(BaseModel):
    mensaje: str

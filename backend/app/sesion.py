"""Sesión en cookie httpOnly (RNF-07) y dependencias para saber quién hace el pedido."""

from datetime import timedelta
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.config import Settings, obtener_settings
from app.db import obtener_sesion_db
from app.modelos import Usuario
from app.seguridad import DatosSesion, SesionInvalidaError, ahora, crear_jwt, leer_jwt

NOMBRE_COOKIE = "sesion"

SettingsDep = Annotated[Settings, Depends(obtener_settings)]
DbDep = Annotated[Session, Depends(obtener_sesion_db)]


def abrir_sesion(respuesta: Response, usuario: Usuario, settings: Settings) -> None:
    duracion = timedelta(days=settings.sesion_dias)
    token = crear_jwt(
        DatosSesion(usuario.id, usuario.version_sesion), settings.jwt_secret, duracion, ahora()
    )
    respuesta.set_cookie(
        NOMBRE_COOKIE,
        token,
        max_age=int(duracion.total_seconds()),
        httponly=True,  # JavaScript no la puede leer
        secure=settings.cookie_segura,
        samesite="lax",  # no viaja en pedidos POST desde otros sitios (CSRF)
        path="/",
    )


def cerrar_sesion(respuesta: Response, settings: Settings) -> None:
    respuesta.delete_cookie(
        NOMBRE_COOKIE, path="/", httponly=True, secure=settings.cookie_segura, samesite="lax"
    )


NO_AUTENTICADO = HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Iniciá sesión para seguir")


def usuario_actual(
    db: DbDep,
    settings: SettingsDep,
    sesion: Annotated[str | None, Cookie(alias=NOMBRE_COOKIE)] = None,
) -> Usuario:
    if not sesion:
        raise NO_AUTENTICADO
    try:
        datos = leer_jwt(sesion, settings.jwt_secret)
    except SesionInvalidaError:
        raise NO_AUTENTICADO from None
    usuario = db.get(Usuario, datos.usuario_id)
    # Cambiar la contraseña incrementa version_sesion y deja afuera las sesiones viejas (CU-11).
    if usuario is None or not usuario.activo or usuario.version_sesion != datos.version:
        raise NO_AUTENTICADO
    return usuario


UsuarioActual = Annotated[Usuario, Depends(usuario_actual)]

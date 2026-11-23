"""Cuentas: registro (CU-01), verificación (CU-02), ingreso y salida (CU-03), recuperación (CU-11).

Los mensajes de error no revelan si un DNI o un email están registrados.
"""

from datetime import datetime, timedelta
from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.correo import EnviadorDeEmail, Mensaje, enviar_sin_fallar, obtener_enviador
from app.correo.plantillas import email_de_recuperacion, email_de_verificacion
from app.dominio.cuentas import (
    VIGENCIA_RECUPERACION,
    VIGENCIA_VERIFICACION,
    EstadoIntentos,
    esta_bloqueado,
    normalizar_email,
    registrar_exito,
    registrar_fallo,
    token_vigente,
)
from app.dominio.identidad import DniInvalidoError, normalizar_dni
from app.esquemas import (
    Aviso,
    Ingreso,
    PedidoPorEmail,
    Registro,
    Restablecer,
    TokenDeEnlace,
    UsuarioPropio,
)
from app.modelos import Token, Usuario
from app.seguridad import (
    HASH_SEÑUELO,
    ahora,
    generar_token_de_enlace,
    hash_de_token,
    hashear_password,
    necesita_rehash,
    verificar_password,
)
from app.sesion import DbDep, SettingsDep, UsuarioActual, abrir_sesion, cerrar_sesion

router = APIRouter(prefix="/auth", tags=["cuentas"])

EnviadorDep = Annotated[EnviadorDeEmail, Depends(obtener_enviador)]

AVISO_REVISA_TU_CORREO = Aviso(
    mensaje="Si los datos corresponden a una cuenta, te enviamos un email. Revisá tu correo."
)
CREDENCIALES_INCORRECTAS = HTTPException(
    status.HTTP_401_UNAUTHORIZED, detail="DNI, email o contraseña incorrectos"
)


def a_usuario_propio(usuario: Usuario) -> UsuarioPropio:
    return UsuarioPropio(
        id=usuario.id,
        nombre=usuario.nombre,
        apellido=usuario.apellido,
        email=usuario.email,
        rol=usuario.rol,
        email_verificado=usuario.email_verificado_en is not None,
    )


def nuevo_token(db: Session, usuario: Usuario, proposito: str, vigencia: timedelta) -> str:
    """Crea un token de un solo uso e invalida los anteriores del mismo propósito."""
    momento = ahora()
    db.execute(
        update(Token)
        .where(Token.usuario_id == usuario.id, Token.proposito == proposito)
        .where(Token.usado_en.is_(None))
        .values(usado_en=momento)
    )
    token, hash_ = generar_token_de_enlace()
    db.add(
        Token(usuario_id=usuario.id, proposito=proposito, hash=hash_, expira_en=momento + vigencia)
    )
    return token


def consumir_token(db: Session, token: str, proposito: str) -> Usuario:
    registro = db.scalar(
        select(Token).where(Token.hash == hash_de_token(token), Token.proposito == proposito)
    )
    momento = ahora()
    if registro is None or not token_vigente(registro.expira_en, registro.usado_en, momento):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="El enlace venció o ya se usó. Pedí uno nuevo."
        )
    registro.usado_en = momento
    usuario = db.get(Usuario, registro.usuario_id)
    if usuario is None or not usuario.activo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="El enlace ya no es válido")
    return usuario


def enlace(base: str, ruta: str, token: str) -> str:
    return f"{base.rstrip('/')}{ruta}?{urlencode({'token': token})}"


def programar_envio(tareas: BackgroundTasks, enviador: EnviadorDeEmail, mensaje: Mensaje) -> None:
    tareas.add_task(enviar_sin_fallar, enviador, mensaje)


@router.post("/registro", status_code=status.HTTP_201_CREATED)
def registrarse(
    datos: Registro,
    db: DbDep,
    settings: SettingsDep,
    enviador: EnviadorDep,
    tareas: BackgroundTasks,
) -> Aviso:
    usuario = Usuario(
        dni=datos.dni,
        nombre=datos.nombre,
        apellido=datos.apellido,
        email=datos.email,
        password_hash=hashear_password(datos.password),
        acepto_terminos_en=ahora(),
    )
    db.add(usuario)
    try:
        db.flush()  # las restricciones UNIQUE de la base deciden si el DNI o el email existen
    except IntegrityError:
        db.rollback()
        # CU-01 3a: se avisa sin revelar cuál de los dos ya está registrado.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Ya existe una cuenta con ese DNI o ese email. "
                "Probá ingresar o recuperar tu contraseña."
            ),
        ) from None
    token = nuevo_token(db, usuario, "verificacion", VIGENCIA_VERIFICACION)
    db.commit()
    url = enlace(settings.frontend_url, "/verificar", token)
    programar_envio(tareas, enviador, email_de_verificacion(usuario.email, usuario.nombre, url))
    return Aviso(mensaje="Te enviamos un email para confirmar tu cuenta. Revisá tu correo.")


@router.post("/verificar")
def verificar_email(
    datos: TokenDeEnlace, db: DbDep, settings: SettingsDep, respuesta: Response
) -> UsuarioPropio:
    usuario = consumir_token(db, datos.token, "verificacion")
    usuario.email_verificado_en = usuario.email_verificado_en or ahora()
    db.commit()
    abrir_sesion(respuesta, usuario, settings)  # CU-02: al verificar, queda adentro
    return a_usuario_propio(usuario)


@router.post("/reenviar-verificacion", status_code=status.HTTP_202_ACCEPTED)
def reenviar_verificacion(
    datos: PedidoPorEmail,
    db: DbDep,
    settings: SettingsDep,
    enviador: EnviadorDep,
    tareas: BackgroundTasks,
) -> Aviso:
    usuario = db.scalar(select(Usuario).where(Usuario.email == datos.email))
    if usuario is not None and usuario.activo and usuario.email_verificado_en is None:
        token = nuevo_token(db, usuario, "verificacion", VIGENCIA_VERIFICACION)
        db.commit()
        url = enlace(settings.frontend_url, "/verificar", token)
        programar_envio(tareas, enviador, email_de_verificacion(usuario.email, usuario.nombre, url))
    return AVISO_REVISA_TU_CORREO


def buscar_por_identificador(db: Session, identificador: str) -> Usuario | None:
    if "@" in identificador:
        return db.scalar(select(Usuario).where(Usuario.email == normalizar_email(identificador)))
    try:
        dni = normalizar_dni(identificador)
    except DniInvalidoError:
        return None
    return db.scalar(select(Usuario).where(Usuario.dni == dni))


def estado_de_intentos(usuario: Usuario) -> EstadoIntentos:
    return EstadoIntentos(
        usuario.intentos_fallidos, usuario.ultimo_fallo_en, usuario.bloqueado_hasta
    )


def guardar_intentos(usuario: Usuario, estado: EstadoIntentos) -> None:
    usuario.intentos_fallidos = estado.intentos_fallidos
    usuario.ultimo_fallo_en = estado.ultimo_fallo_en
    usuario.bloqueado_hasta = estado.bloqueado_hasta


def minutos_restantes(hasta: datetime, desde: datetime) -> int:
    return max(1, int((hasta - desde).total_seconds() // 60) + 1)


@router.post("/ingreso")
def ingresar(
    datos: Ingreso, db: DbDep, settings: SettingsDep, respuesta: Response
) -> UsuarioPropio:
    usuario = buscar_por_identificador(db, datos.identificador)
    momento = ahora()
    if usuario is None:
        verificar_password(HASH_SEÑUELO, datos.password)  # mismo tiempo de respuesta
        raise CREDENCIALES_INCORRECTAS

    estado = estado_de_intentos(usuario)
    if esta_bloqueado(estado, momento) and usuario.bloqueado_hasta is not None:
        minutos = minutos_restantes(usuario.bloqueado_hasta, momento)
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Demasiados intentos fallidos. Probá de nuevo en {minutos} minutos.",
        )

    if not verificar_password(usuario.password_hash, datos.password) or not usuario.activo:
        guardar_intentos(usuario, registrar_fallo(estado, momento))
        db.commit()
        raise CREDENCIALES_INCORRECTAS

    guardar_intentos(usuario, registrar_exito())
    if necesita_rehash(usuario.password_hash):
        usuario.password_hash = hashear_password(datos.password)
    db.commit()

    if usuario.email_verificado_en is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Todavía no confirmaste tu email. Revisá tu correo o pedí otro enlace.",
        )
    abrir_sesion(respuesta, usuario, settings)
    return a_usuario_propio(usuario)


@router.post("/salir", status_code=status.HTTP_204_NO_CONTENT)
def salir(respuesta: Response, settings: SettingsDep) -> None:
    cerrar_sesion(respuesta, settings)


@router.get("/yo")
def yo(usuario: UsuarioActual) -> UsuarioPropio:
    return a_usuario_propio(usuario)


@router.post("/recuperar", status_code=status.HTTP_202_ACCEPTED)
def recuperar_password(
    datos: PedidoPorEmail,
    db: DbDep,
    settings: SettingsDep,
    enviador: EnviadorDep,
    tareas: BackgroundTasks,
) -> Aviso:
    usuario = db.scalar(select(Usuario).where(Usuario.email == datos.email))
    # CU-11 alternativo: la misma respuesta exista o no la cuenta.
    if usuario is not None and usuario.activo:
        token = nuevo_token(db, usuario, "recuperacion", VIGENCIA_RECUPERACION)
        db.commit()
        url = enlace(settings.frontend_url, "/restablecer", token)
        programar_envio(tareas, enviador, email_de_recuperacion(usuario.email, usuario.nombre, url))
    return AVISO_REVISA_TU_CORREO


@router.post("/restablecer")
def restablecer_password(
    datos: Restablecer, db: DbDep, respuesta: Response, settings: SettingsDep
) -> Aviso:
    usuario = consumir_token(db, datos.token, "recuperacion")
    usuario.password_hash = hashear_password(datos.password)
    usuario.version_sesion += 1  # cierra todas las sesiones abiertas (CU-11)
    guardar_intentos(usuario, registrar_exito())
    # Quien recibió el email en esa casilla demostró que es suya.
    usuario.email_verificado_en = usuario.email_verificado_en or ahora()
    db.commit()
    cerrar_sesion(respuesta, settings)
    return Aviso(mensaje="Listo: ya podés ingresar con tu contraseña nueva.")

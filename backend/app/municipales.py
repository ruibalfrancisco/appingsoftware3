"""Alta, cambio de rol y baja de personal municipal (CU-10).

El plan recorta RF-32: los usuarios municipales se cargan con este script, no desde la app.

    uv run python -m app.municipales --dni 20111222 --nombre Ana --apellido Pérez \\
        --email ana@villaallende.gob.ar --rol operador

- Si ya existe alguien con ese DNI o email, se le actualizan los datos y el rol.
- Con la variable de entorno CLAVE_INICIAL, esa es su contraseña (local y CI). Sin ella, se
  imprime un enlace de un solo uso, válido 72 horas, para que elija la suya.
- Con --desactivar, ya no puede ingresar y se cierran sus sesiones abiertas.
"""

import argparse
import os
import secrets
import sys
from datetime import timedelta
from typing import TextIO

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import obtener_settings
from app.db import obtener_motor
from app.dominio.cuentas import normalizar_email, validar_password
from app.dominio.gestion import ROLES_MUNICIPALES
from app.dominio.identidad import normalizar_dni
from app.modelos import Usuario
from app.rutas.cuentas import enlace, nuevo_token
from app.seguridad import ahora, hashear_password

VIGENCIA_INVITACION = timedelta(hours=72)


def argumentos(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Alta de personal municipal (CU-10)")
    parser.add_argument("--dni", required=True)
    parser.add_argument("--email")
    parser.add_argument("--nombre")
    parser.add_argument("--apellido")
    parser.add_argument("--rol", choices=sorted(ROLES_MUNICIPALES), default="operador")
    parser.add_argument("--desactivar", action="store_true")
    datos = parser.parse_args(argv)
    if not datos.desactivar and not (datos.email and datos.nombre and datos.apellido):
        parser.error("para dar de alta hacen falta --email, --nombre y --apellido")
    return datos


def desactivar(db: Session, dni: str, salida: TextIO) -> int:
    usuario = db.scalar(select(Usuario).where(Usuario.dni == normalizar_dni(dni)))
    if usuario is None:
        print(f"No hay ningún usuario con DNI {dni}", file=salida)
        return 1
    usuario.activo = False
    usuario.version_sesion += 1  # cierra las sesiones abiertas
    db.commit()
    print(f"Desactivado: {usuario.nombre} {usuario.apellido} ya no puede ingresar.", file=salida)
    return 0


def dar_de_alta(db: Session, datos: argparse.Namespace, salida: TextIO) -> int:
    dni = normalizar_dni(datos.dni)
    email = normalizar_email(datos.email)
    clave = os.environ.get("CLAVE_INICIAL")
    if clave:
        validar_password(clave)
    usuario = db.scalar(select(Usuario).where(or_(Usuario.dni == dni, Usuario.email == email)))
    momento = ahora()
    if usuario is None:
        usuario = Usuario(
            dni=dni,
            email=email,
            # Sin CLAVE_INICIAL, una contraseña que nadie conoce hasta usar el enlace.
            password_hash=hashear_password(clave or secrets.token_urlsafe(32)),
            acepto_terminos_en=momento,
        )
        db.add(usuario)
    elif clave:
        usuario.password_hash = hashear_password(clave)
    usuario.nombre = datos.nombre
    usuario.apellido = datos.apellido
    usuario.rol = datos.rol
    usuario.activo = True
    usuario.email_verificado_en = usuario.email_verificado_en or momento
    db.flush()

    print(f"Listo: {datos.nombre} {datos.apellido} ({email}) es {datos.rol}.", file=salida)
    if not clave:
        token = nuevo_token(db, usuario, "recuperacion", VIGENCIA_INVITACION)
        url = enlace(obtener_settings().frontend_url, "/restablecer", token)
        print(f"Para elegir su contraseña (vale 72 h, una sola vez):\n{url}", file=salida)
    db.commit()
    return 0


def main(argv: list[str] | None = None, salida: TextIO = sys.stdout) -> int:
    datos = argumentos(argv)
    with Session(obtener_motor()) as db:
        if datos.desactivar:
            return desactivar(db, datos.dni, salida)
        return dar_de_alta(db, datos, salida)


if __name__ == "__main__":
    sys.exit(main())

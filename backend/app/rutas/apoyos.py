"""CU-05 Apoyar un reclamo existente: similares a 50 m (RN-01) y "Yo también lo vi" (RN-02)."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from geoalchemy2 import Geography
from sqlalchemy import cast, func, select
from sqlalchemy.exc import IntegrityError

from app.dominio.apoyos import (
    MAX_SIMILARES,
    RADIO_SIMILARES_M,
    ApoyoNoPermitidoError,
    validar_apoyo,
)
from app.dominio.estados import ESTADOS_ABIERTOS
from app.dominio.prioridad import resumir_apoyos
from app.esquemas import ApoyoRegistrado, NuevoApoyo, ReclamoSimilar
from app.modelos import Apoyo, Reclamo, TipoReclamo
from app.rutas.reclamos import AlmacenDep, a_tipo_publico, fotos_de_reporte
from app.sesion import DbDep, VecinoVerificado

router = APIRouter(tags=["apoyos"])


@router.get("/reclamos/similares")
def similares(
    usuario: VecinoVerificado,
    db: DbDep,
    almacen: AlmacenDep,
    tipo_id: int,
    latitud: Annotated[float, Query(ge=-90, le=90)],
    longitud: Annotated[float, Query(ge=-180, le=180)],
) -> list[ReclamoSimilar]:
    """RN-01: abiertos, del mismo tipo, a 50 m o menos; hasta 5, del más cercano al más lejano."""
    punto = cast(func.ST_SetSRID(func.ST_MakePoint(longitud, latitud), 4326), Geography)
    distancia = func.ST_Distance(Reclamo.ubicacion, punto).label("distancia")
    filas = db.execute(
        select(Reclamo, TipoReclamo, distancia)
        .join(TipoReclamo, TipoReclamo.id == Reclamo.tipo_id)
        .where(
            Reclamo.tipo_id == tipo_id,
            Reclamo.estado.in_(ESTADOS_ABIERTOS),
            # Sobre geography, en metros y usando el índice GiST de ubicacion.
            func.ST_DWithin(Reclamo.ubicacion, punto, RADIO_SIMILARES_M),
        )
        .order_by(distancia, Reclamo.id.desc())  # a igual distancia, el más nuevo
        .limit(MAX_SIMILARES)
    ).all()
    ids = [reclamo.id for reclamo, _, _ in filas]
    fotos = fotos_de_reporte(db, ids)
    apoyados = set(
        db.scalars(
            select(Apoyo.reclamo_id).where(
                Apoyo.usuario_id == usuario.id, Apoyo.reclamo_id.in_(ids)
            )
        )
    )
    resultado = []
    for reclamo, tipo, metros in filas:
        foto = fotos.get(reclamo.id)
        es_propio = reclamo.usuario_id == usuario.id
        resultado.append(
            ReclamoSimilar(
                id=reclamo.id,
                numero=reclamo.id,
                tipo=a_tipo_publico(tipo),
                descripcion=reclamo.descripcion,
                direccion=reclamo.direccion,
                distancia_m=round(metros),
                estado=reclamo.estado,
                cantidad_apoyos=reclamo.cantidad_apoyos,
                foto_url=almacen.url_firmada(foto.clave_storage) if foto else None,
                es_propio=es_propio,
                ya_apoyado=not es_propio and reclamo.id in apoyados,
            )
        )
    return resultado


@router.post("/reclamos/{reclamo_id}/apoyos", status_code=status.HTTP_201_CREATED)
def apoyar(
    reclamo_id: int, datos: NuevoApoyo, usuario: VecinoVerificado, db: DbDep
) -> ApoyoRegistrado:
    """CU-05 "Yo también lo vi": suma el apoyo y recalcula la prioridad en la misma transacción.

    Los apoyos no cuentan para el límite de 5 reclamos por día (RN-08).
    """
    # FOR UPDATE: si dos vecinos apoyan a la vez, el segundo espera y recalcula con los dos.
    reclamo = db.scalar(select(Reclamo).where(Reclamo.id == reclamo_id).with_for_update())
    if reclamo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No existe ese reclamo")
    ya_apoyo = db.scalar(
        select(func.count())
        .select_from(Apoyo)
        .where(Apoyo.reclamo_id == reclamo.id, Apoyo.usuario_id == usuario.id)
    )
    try:
        validar_apoyo(
            es_creador=reclamo.usuario_id == usuario.id,
            ya_apoyo=bool(ya_apoyo),
            estado=reclamo.estado,
        )
    except ApoyoNoPermitidoError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from None

    db.add(Apoyo(reclamo_id=reclamo.id, usuario_id=usuario.id, gravedad=datos.gravedad))
    try:
        db.flush()
    except IntegrityError:
        # La restricción UNIQUE (reclamo, vecino) de la base es la última palabra (RN-02).
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Ya apoyaste este reclamo") from None

    gravedades = list(db.scalars(select(Apoyo.gravedad).where(Apoyo.reclamo_id == reclamo.id)))
    resumen = resumir_apoyos(gravedades)  # RN-04
    reclamo.cantidad_apoyos = resumen.cantidad
    reclamo.gravedad_promedio = resumen.gravedad_promedio
    reclamo.prioridad = resumen.prioridad
    db.commit()
    return ApoyoRegistrado(
        numero=reclamo.id,
        cantidad_apoyos=resumen.cantidad,
        gravedad_promedio=resumen.gravedad_promedio,
        prioridad=resumen.prioridad,
    )

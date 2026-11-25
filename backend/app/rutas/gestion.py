"""Back office municipal: Tablero priorizado (CU-07), mapa (CU-09) y cambio de estado (CU-08).

Todo bajo /gestion y solo para operadores y administradores: un vecino recibe 403 (IT-07).
"""

import logging
import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select

from app.dominio.estados import (
    ESTADOS_ABIERTOS,
    DatoObligatorioError,
    EstadoReclamo,
    TransicionInvalidaError,
    validar_transicion,
)
from app.dominio.gestion import (
    MAX_EN_TABLERO,
    destinatarios_de_novedad,
    es_final,
    es_personal_municipal,
    rango_de_fechas,
    transiciones_desde,
)
from app.dominio.reclamos import ZONA_HORARIA
from app.esquemas import (
    AreaPublica,
    CambioDeEstado,
    CambioRegistrado,
    EntradaDeHistorialDeGestion,
    FotoPublica,
    ReclamoDeGestion,
    ReclamoEnTablero,
)
from app.fotos import MAX_BYTES, FotoInvalidaError, procesar_foto
from app.modelos import (
    Apoyo,
    Area,
    Foto,
    HistorialEstado,
    Notificacion,
    Reclamo,
    TipoReclamo,
    Usuario,
)
from app.rutas.reclamos import AlmacenDep, a_tipo_publico, coordenadas, fotos_de_reporte
from app.seguridad import ahora
from app.sesion import DbDep, PersonalMunicipal, personal_municipal

log = logging.getLogger(__name__)

router = APIRouter(
    prefix="/gestion", tags=["gestión municipal"], dependencies=[Depends(personal_municipal)]
)


@router.get("/areas")
def areas(db: DbDep) -> list[AreaPublica]:
    """RF-29: las áreas a las que se asigna un reclamo."""
    return [
        AreaPublica(id=a.id, nombre=a.nombre) for a in db.scalars(select(Area).order_by(Area.id))
    ]


@router.get("/reclamos")
def tablero(
    db: DbDep,
    almacen: AlmacenDep,
    tipo_id: int | None = None,
    estado: Annotated[list[EstadoReclamo] | None, Query()] = None,
    area_id: int | None = None,
    desde: date | None = None,
    hasta: date | None = None,
) -> list[ReclamoEnTablero]:
    """RF-25: sin filtro de estado, los abiertos; siempre de mayor a menor prioridad (RN-04)."""
    estados = estado or sorted(ESTADOS_ABIERTOS)
    consulta = (
        select(Reclamo, TipoReclamo, Area.nombre)
        .join(TipoReclamo, TipoReclamo.id == Reclamo.tipo_id)
        .outerjoin(Area, Area.id == Reclamo.area_id)
        .where(Reclamo.estado.in_(estados))
    )
    if tipo_id is not None:
        consulta = consulta.where(Reclamo.tipo_id == tipo_id)
    if area_id is not None:
        consulta = consulta.where(Reclamo.area_id == area_id)
    inicio, fin = rango_de_fechas(desde, hasta)
    if inicio is not None:
        consulta = consulta.where(Reclamo.creado_en >= inicio)
    if fin is not None:
        consulta = consulta.where(Reclamo.creado_en < fin)
    filas = db.execute(
        # A igual prioridad, el más antiguo primero (RN-04).
        consulta.order_by(Reclamo.prioridad.desc(), Reclamo.creado_en, Reclamo.id).limit(
            MAX_EN_TABLERO
        )
    ).all()

    fotos = fotos_de_reporte(db, [reclamo.id for reclamo, _, _ in filas])
    resultado = []
    for reclamo, tipo, area in filas:
        latitud, longitud = coordenadas(reclamo)
        foto = fotos.get(reclamo.id)
        resultado.append(
            ReclamoEnTablero(
                id=reclamo.id,
                numero=reclamo.id,
                tipo=a_tipo_publico(tipo),
                estado=reclamo.estado,
                area=area,
                descripcion=reclamo.descripcion,
                direccion=reclamo.direccion,
                latitud=latitud,
                longitud=longitud,
                cantidad_apoyos=reclamo.cantidad_apoyos,
                gravedad_promedio=reclamo.gravedad_promedio,
                prioridad=reclamo.prioridad,
                creado_en=reclamo.creado_en,
                foto_url=almacen.url_firmada(foto.clave_storage) if foto else None,
            )
        )
    return resultado


@router.get("/reclamos/{reclamo_id}")
def detalle(reclamo_id: int, db: DbDep, almacen: AlmacenDep) -> ReclamoDeGestion:
    """RF-27: fotos, ubicación, descripción, apoyos, gravedad, prioridad e historial."""
    reclamo = db.get(Reclamo, reclamo_id)
    if reclamo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No existe ese reclamo")
    tipo = db.get(TipoReclamo, reclamo.tipo_id)
    assert tipo is not None  # FK obligatoria  # noqa: S101
    area = db.get(Area, reclamo.area_id) if reclamo.area_id is not None else None
    fotos = db.scalars(select(Foto).where(Foto.reclamo_id == reclamo.id).order_by(Foto.id))
    historial = db.execute(
        select(HistorialEstado, Usuario)
        .join(Usuario, Usuario.id == HistorialEstado.usuario_id)
        .where(HistorialEstado.reclamo_id == reclamo.id)
        .order_by(HistorialEstado.creado_en, HistorialEstado.id)
    ).all()
    latitud, longitud = coordenadas(reclamo)
    return ReclamoDeGestion(
        id=reclamo.id,
        numero=reclamo.id,
        tipo=a_tipo_publico(tipo),
        estado=reclamo.estado,
        area=AreaPublica(id=area.id, nombre=area.nombre) if area else None,
        descripcion=reclamo.descripcion,
        direccion=reclamo.direccion,
        latitud=latitud,
        longitud=longitud,
        cantidad_apoyos=reclamo.cantidad_apoyos,
        gravedad_promedio=reclamo.gravedad_promedio,
        prioridad=reclamo.prioridad,
        creado_en=reclamo.creado_en,
        actualizado_en=reclamo.actualizado_en,
        cerrado_en=reclamo.cerrado_en,
        fotos=[
            FotoPublica(
                tipo=foto.tipo,
                url=almacen.url_firmada(foto.clave_storage),
                ancho=foto.ancho,
                alto=foto.alto,
            )
            for foto in fotos
        ],
        historial=[
            EntradaDeHistorialDeGestion(
                estado_anterior=entrada.estado_anterior,
                estado_nuevo=entrada.estado_nuevo,
                comentario=entrada.comentario,
                creado_en=entrada.creado_en,
                # Del vecino no se muestra el nombre: solo que fue él quien lo cargó.
                autor=f"{autor.nombre} {autor.apellido}"
                if es_personal_municipal(autor.rol)
                else "Vecino",
            )
            for entrada, autor in historial
        ],
        transiciones=transiciones_desde(reclamo.estado),
    )


@router.post("/reclamos/{reclamo_id}/estado")
def cambiar_estado(
    reclamo_id: int,
    datos: Annotated[CambioDeEstado, Form()],
    operador: PersonalMunicipal,
    db: DbDep,
    almacen: AlmacenDep,
    foto: UploadFile | None = None,
) -> CambioRegistrado:
    """CU-08: valida la transición (RN-05), guarda el historial y genera las novedades (RN-07)."""
    # FOR UPDATE: dos operadores sobre el mismo reclamo no se pisan.
    reclamo = db.scalar(select(Reclamo).where(Reclamo.id == reclamo_id).with_for_update())
    if reclamo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No existe ese reclamo")
    if datos.area_id is not None and db.get(Area, datos.area_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Elegí un área válida")
    # Si ya tenía un área asignada, sirve para pasar a En proceso.
    area_id = datos.area_id if datos.area_id is not None else reclamo.area_id
    try:
        validar_transicion(
            EstadoReclamo(reclamo.estado),
            datos.estado,
            comentario=datos.comentario,
            area_id=area_id,
        )
    except TransicionInvalidaError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from None
    except DatoObligatorioError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from None

    hay_foto = foto is not None and bool(foto.filename)
    if hay_foto and datos.estado is not EstadoReclamo.RESUELTO:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La foto del después se sube al resolver el reclamo",
        )
    momento = ahora()
    clave = None
    if foto is not None and hay_foto:  # RF-30
        try:
            procesada = procesar_foto(foto.file.read(MAX_BYTES + 1))  # RN-10
        except FotoInvalidaError as error:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from None
        mes = momento.astimezone(ZONA_HORARIA).strftime("%Y/%m")
        clave = f"reclamos/{mes}/{uuid.uuid4()}-resolucion.jpg"
        almacen.guardar(clave, procesada.contenido, procesada.tipo_mime)

    try:
        historial = HistorialEstado(
            reclamo_id=reclamo.id,
            estado_anterior=reclamo.estado,
            estado_nuevo=datos.estado,
            usuario_id=operador.id,
            comentario=datos.comentario or None,
        )
        db.add(historial)
        reclamo.estado = datos.estado
        reclamo.area_id = area_id
        reclamo.actualizado_en = momento
        if es_final(datos.estado):
            reclamo.cerrado_en = momento
        if clave is not None:
            db.add(
                Foto(
                    reclamo_id=reclamo.id,
                    tipo="resolucion",
                    clave_storage=clave,
                    ancho=procesada.ancho,
                    alto=procesada.alto,
                )
            )
        db.flush()
        apoyantes = db.scalars(select(Apoyo.usuario_id).where(Apoyo.reclamo_id == reclamo.id))
        destinatarios = destinatarios_de_novedad(reclamo.usuario_id, apoyantes, operador.id)
        db.add_all(
            Notificacion(usuario_id=destino, reclamo_id=reclamo.id, historial_id=historial.id)
            for destino in destinatarios
        )
        db.commit()
    except Exception:
        db.rollback()
        if clave is not None:
            try:
                almacen.borrar(clave)
            except Exception:
                log.exception("No se pudo borrar la foto huérfana %s", clave)
        raise

    return CambioRegistrado(
        estado=reclamo.estado,
        transiciones=transiciones_desde(reclamo.estado),
        notificados=len(destinatarios),
    )

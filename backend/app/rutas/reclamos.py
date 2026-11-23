"""Reclamos: tipos, ejido, creación (CU-04), los del vecino y detalle."""

import logging
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile, status
from geoalchemy2.elements import WKTElement
from geoalchemy2.shape import to_shape
from shapely.geometry import Point
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.almacenamiento import AlmacenDeFotos, obtener_almacen
from app.dominio.estados import EstadoReclamo
from app.dominio.geocerca import centro_del_ejido, dentro_del_ejido, geojson_del_ejido
from app.dominio.prioridad import resumir_apoyos
from app.dominio.reclamos import (
    DIRECCION_MAX,
    ZONA_HORARIA,
    inicio_del_dia,
    puede_crear_otro,
)
from app.esquemas import (
    EntradaDeHistorial,
    FotoPublica,
    NuevoReclamo,
    ReclamoCreado,
    ReclamoDetalle,
    ReclamoResumen,
    TipoPublico,
)
from app.fotos import MAX_BYTES, FotoInvalidaError, procesar_foto
from app.geocodificacion import direccion_de
from app.modelos import Apoyo, Area, Foto, HistorialEstado, Reclamo, TipoReclamo
from app.seguridad import ahora
from app.sesion import DbDep, SettingsDep, UsuarioActual, VecinoVerificado

log = logging.getLogger(__name__)

router = APIRouter(tags=["reclamos"])

AlmacenDep = Annotated[AlmacenDeFotos, Depends(obtener_almacen)]


def a_tipo_publico(tipo: TipoReclamo) -> TipoPublico:
    return TipoPublico(
        id=tipo.id, codigo=tipo.codigo, nombre=tipo.nombre, icono=tipo.icono, color=tipo.color
    )


def coordenadas(reclamo: Reclamo) -> tuple[float, float]:
    """(latitud, longitud) del punto guardado."""
    punto = to_shape(reclamo.ubicacion)
    if not isinstance(punto, Point):  # la columna es geography(POINT)
        raise TypeError("La ubicación del reclamo no es un punto")
    return punto.y, punto.x


def fotos_de_reporte(db: Session, reclamo_ids: list[int]) -> dict[int, Foto]:
    """La foto del reporte de cada reclamo, en una sola consulta (no una por reclamo)."""
    if not reclamo_ids:
        return {}
    fotos = db.scalars(
        select(Foto)
        .where(Foto.reclamo_id.in_(reclamo_ids), Foto.tipo == "reporte")
        .order_by(Foto.id.desc())  # si hubiera más de una, queda la primera
    )
    return {foto.reclamo_id: foto for foto in fotos}


def a_entrada_de_historial(entrada: HistorialEstado) -> EntradaDeHistorial:
    return EntradaDeHistorial(
        estado_anterior=entrada.estado_anterior,
        estado_nuevo=entrada.estado_nuevo,
        comentario=entrada.comentario,
        creado_en=entrada.creado_en,
    )


@router.get("/tipos")
def listar_tipos(db: DbDep) -> list[TipoPublico]:
    """RF-06: la grilla de tipos."""
    tipos = db.scalars(select(TipoReclamo).where(TipoReclamo.activo).order_by(TipoReclamo.id))
    return [a_tipo_publico(tipo) for tipo in tipos]


@router.get("/ejido")
def ejido() -> dict[str, Any]:
    """RF-09: el polígono para dibujar en el mapa y dónde abrirlo si no hay GPS (CU-04 3a)."""
    latitud, longitud = centro_del_ejido()
    return {"geojson": geojson_del_ejido(), "centro": {"latitud": latitud, "longitud": longitud}}


@router.get("/direccion")
def direccion(
    _usuario: VecinoVerificado,
    settings: SettingsDep,
    latitud: Annotated[float, Query(ge=-90, le=90)],
    longitud: Annotated[float, Query(ge=-180, le=180)],
) -> dict[str, str | None]:
    """RF-10: dirección aproximada del pin. Solo con sesión, para no ser un proxy abierto."""
    if not settings.geocodificar:
        return {"direccion": None}
    return {"direccion": direccion_de(latitud, longitud)}


@router.post("/reclamos", status_code=status.HTTP_201_CREATED)
def crear_reclamo(
    datos: Annotated[NuevoReclamo, Form()],
    foto: UploadFile,
    usuario: VecinoVerificado,
    db: DbDep,
    almacen: AlmacenDep,
    settings: SettingsDep,
) -> ReclamoCreado:
    """CU-04: guarda el reclamo con su foto y el creador como primer apoyo."""
    # RN-06: se valida aunque el frontend ya bloquee el pin afuera del ejido.
    if not dentro_del_ejido(datos.latitud, datos.longitud):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Esta ubicación está fuera de Villa Allende",
        )
    tipo = db.get(TipoReclamo, datos.tipo_id)
    if tipo is None or not tipo.activo:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Elegí un tipo de reclamo válido"
        )

    momento = ahora()
    reclamos_de_hoy = db.scalar(
        select(func.count())
        .select_from(Reclamo)
        .where(Reclamo.usuario_id == usuario.id, Reclamo.creado_en >= inicio_del_dia(momento))
    )
    if not puede_crear_otro(reclamos_de_hoy or 0):  # RN-08
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Llegaste al máximo de 5 reclamos por día. Igual podés apoyar reclamos existentes."
            ),
        )

    try:
        procesada = procesar_foto(foto.file.read(MAX_BYTES + 1))  # RN-10
    except FotoInvalidaError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from None

    # RF-10: si el vecino no escribió la dirección (o confirmó el pin antes de que apareciera
    # la sugerida), se busca acá. Casi siempre ya está en caché por la consulta del pin.
    direccion = datos.direccion or None
    if direccion is None and settings.geocodificar:
        encontrada = direccion_de(datos.latitud, datos.longitud)
        direccion = encontrada[:DIRECCION_MAX] if encontrada else None

    mes = momento.astimezone(ZONA_HORARIA).strftime("%Y/%m")
    clave = f"reclamos/{mes}/{uuid.uuid4()}.jpg"
    almacen.guardar(clave, procesada.contenido, procesada.tipo_mime)

    inicial = resumir_apoyos([datos.gravedad])  # RN-04 con el creador solo
    try:
        reclamo = Reclamo(
            usuario_id=usuario.id,
            tipo_id=tipo.id,
            descripcion=datos.descripcion,
            direccion=direccion,
            ubicacion=WKTElement(f"POINT({datos.longitud} {datos.latitud})", srid=4326),
            estado=EstadoReclamo.PENDIENTE,
            cantidad_apoyos=inicial.cantidad,
            gravedad_promedio=inicial.gravedad_promedio,
            prioridad=inicial.prioridad,
        )
        db.add(reclamo)
        db.flush()
        db.add_all(
            [
                Apoyo(
                    reclamo_id=reclamo.id,
                    usuario_id=usuario.id,
                    gravedad=datos.gravedad,
                    es_creador=True,
                ),
                Foto(
                    reclamo_id=reclamo.id,
                    tipo="reporte",
                    clave_storage=clave,
                    ancho=procesada.ancho,
                    alto=procesada.alto,
                ),
                HistorialEstado(
                    reclamo_id=reclamo.id,
                    estado_anterior=None,
                    estado_nuevo=EstadoReclamo.PENDIENTE,
                    usuario_id=usuario.id,
                ),
            ]
        )
        db.commit()
    except Exception:
        db.rollback()
        # Sin reclamo no tiene sentido guardar la foto: se borra para no dejar huérfanas.
        try:
            almacen.borrar(clave)
        except Exception:
            log.exception("No se pudo borrar la foto huérfana %s", clave)
        raise

    return ReclamoCreado(
        id=reclamo.id, numero=reclamo.id, estado=reclamo.estado, prioridad=reclamo.prioridad
    )


# Va antes de /reclamos/{reclamo_id}: si no, "mios" se tomaría como un número de reclamo.
@router.get("/reclamos/mios")
def mis_reclamos(usuario: UsuarioActual, db: DbDep, almacen: AlmacenDep) -> list[ReclamoResumen]:
    """Los reclamos que cargó el vecino, del más nuevo al más viejo, con su ubicación."""
    filas = db.execute(
        select(Reclamo, TipoReclamo)
        .join(TipoReclamo, TipoReclamo.id == Reclamo.tipo_id)
        .where(Reclamo.usuario_id == usuario.id)
        .order_by(Reclamo.creado_en.desc(), Reclamo.id.desc())
    ).all()
    fotos = fotos_de_reporte(db, [reclamo.id for reclamo, _ in filas])
    resumenes = []
    for reclamo, tipo in filas:
        latitud, longitud = coordenadas(reclamo)
        foto = fotos.get(reclamo.id)
        resumenes.append(
            ReclamoResumen(
                id=reclamo.id,
                numero=reclamo.id,
                tipo=a_tipo_publico(tipo),
                descripcion=reclamo.descripcion,
                direccion=reclamo.direccion,
                latitud=latitud,
                longitud=longitud,
                estado=reclamo.estado,
                cantidad_apoyos=reclamo.cantidad_apoyos,
                creado_en=reclamo.creado_en,
                foto_url=almacen.url_firmada(foto.clave_storage) if foto else None,
            )
        )
    return resumenes


@router.get("/reclamos/{reclamo_id}")
def ver_reclamo(
    reclamo_id: int, usuario: UsuarioActual, db: DbDep, almacen: AlmacenDep
) -> ReclamoDetalle:
    reclamo = db.get(Reclamo, reclamo_id)
    if reclamo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No existe ese reclamo")
    tipo = db.get(TipoReclamo, reclamo.tipo_id)
    assert tipo is not None  # FK obligatoria  # noqa: S101
    fotos = db.scalars(select(Foto).where(Foto.reclamo_id == reclamo.id).order_by(Foto.id))
    historial = db.scalars(
        select(HistorialEstado)
        .where(HistorialEstado.reclamo_id == reclamo.id)
        .order_by(HistorialEstado.creado_en, HistorialEstado.id)
    )
    area = db.get(Area, reclamo.area_id) if reclamo.area_id is not None else None
    latitud, longitud = coordenadas(reclamo)
    return ReclamoDetalle(
        id=reclamo.id,
        numero=reclamo.id,
        tipo=a_tipo_publico(tipo),
        descripcion=reclamo.descripcion,
        direccion=reclamo.direccion,
        latitud=latitud,
        longitud=longitud,
        estado=reclamo.estado,
        cantidad_apoyos=reclamo.cantidad_apoyos,
        gravedad_promedio=reclamo.gravedad_promedio,
        prioridad=reclamo.prioridad,
        creado_en=reclamo.creado_en,
        fotos=[
            FotoPublica(
                tipo=foto.tipo,
                url=almacen.url_firmada(foto.clave_storage),
                ancho=foto.ancho,
                alto=foto.alto,
            )
            for foto in fotos
        ],
        area=area.nombre if area else None,
        historial=[a_entrada_de_historial(entrada) for entrada in historial],
        es_propio=reclamo.usuario_id == usuario.id,
    )

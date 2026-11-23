"""CU-04 Crear reclamo contra PostgreSQL + PostGIS real (IT-01, IT-05, IT-06, IT-09)."""

import contextlib
import io
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import Engine, text

from app.almacenamiento import AlmacenEnMemoria, AlmacenS3
from app.config import Settings
from tests.integracion.conftest import crear_usuario, ingresar

CENTRO = {"latitud": -31.2945, "longitud": -64.2955}
CORDOBA_CAPITAL = {"latitud": -31.4167, "longitud": -64.1833}


def foto_con_exif() -> bytes:
    exif = Image.Exif()
    exif[0x0110] = "Modelo del celular de la vecina"
    salida = io.BytesIO()
    Image.new("RGB", (2400, 1800), (90, 90, 90)).save(salida, format="JPEG", exif=exif)
    return salida.getvalue()


def datos_del_reclamo(**cambios: Any) -> dict[str, Any]:
    return {"tipo_id": 1, "titulo": "Bache en la esquina", "gravedad": 7, **CENTRO, **cambios}


def reclamar(cliente: TestClient, foto: bytes | None = None, **cambios: Any) -> Any:
    archivo = foto if foto is not None else foto_con_exif()
    return cliente.post(
        "/reclamos",
        data=datos_del_reclamo(**cambios),
        files={"foto": ("bache.jpg", archivo, "image/jpeg")},
    )


@pytest.fixture
def vecina(cliente_con_almacen: TestClient, base_limpia: Engine) -> TestClient:
    crear_usuario(base_limpia, "30111222", "vecina@ejemplo.com")
    ingresar(cliente_con_almacen, "30111222")
    return cliente_con_almacen


def test_rf06_tipos_y_ejido_son_publicos(cliente: TestClient) -> None:
    tipos = cliente.get("/tipos").json()
    ejido = cliente.get("/ejido").json()

    assert [t["codigo"] for t in tipos] == [
        "bache", "luminaria", "senalizacion", "basura", "semaforo", "otro",
    ]  # fmt: skip
    assert ejido["geojson"]["features"][0]["geometry"]["type"] == "Polygon"
    assert set(ejido["centro"]) == {"latitud", "longitud"}


def test_it01_crear_reclamo_queda_pendiente_con_el_creador_como_primer_apoyo(
    vecina: TestClient, almacen: AlmacenEnMemoria, base_limpia: Engine
) -> None:
    respuesta = reclamar(vecina, descripcion="Profundo, cuidado con las motos", gravedad=8)

    assert respuesta.status_code == 201, respuesta.text
    creado = respuesta.json()
    assert creado["estado"] == "PENDIENTE"
    assert creado["prioridad"] == 8  # RN-04 con un solo vecino: su gravedad
    with base_limpia.connect() as c:
        apoyos = c.execute(text("SELECT gravedad, es_creador FROM apoyo")).all()
        historial = c.execute(
            text("SELECT estado_anterior, estado_nuevo FROM historial_estado")
        ).all()
        clave = c.execute(text("SELECT clave_storage FROM foto")).scalar_one()
        distancia = c.execute(
            text(
                "SELECT ST_Distance(ubicacion, ST_GeogFromText('POINT(-64.2955 -31.2945)'))"
                " FROM reclamo"
            )
        ).scalar_one()
    assert apoyos == [(8, True)]
    assert historial == [(None, "PENDIENTE")]
    assert clave in almacen.objetos
    assert clave.startswith("reclamos/") and clave.endswith(".jpg")
    assert distancia < 1  # el punto quedó guardado donde estaba el pin


def test_it09_la_foto_guardada_no_tiene_exif_y_el_detalle_no_expone_datos_personales(
    vecina: TestClient, almacen: AlmacenEnMemoria
) -> None:
    numero = reclamar(vecina).json()["numero"]

    ((contenido, tipo_mime),) = almacen.objetos.values()
    guardada = Image.open(io.BytesIO(contenido))
    assert tipo_mime == "image/jpeg"
    assert len(guardada.getexif()) == 0
    assert b"Modelo del celular" not in contenido
    assert max(guardada.size) == 1600

    detalle = vecina.get(f"/reclamos/{numero}").json()
    assert detalle["es_propio"] is True
    assert detalle["tipo"]["codigo"] == "bache"
    assert detalle["latitud"] == pytest.approx(CENTRO["latitud"])
    assert detalle["fotos"][0]["url"].startswith("https://fotos.example/reclamos/")
    texto = str(detalle)
    assert "30111222" not in texto and "vecina@ejemplo.com" not in texto  # RNF-08


def test_it05_fuera_del_ejido_responde_422_aunque_el_frontend_lo_permita(
    vecina: TestClient, almacen: AlmacenEnMemoria, base_limpia: Engine
) -> None:
    respuesta = reclamar(vecina, **CORDOBA_CAPITAL)

    assert respuesta.status_code == 422
    assert "fuera de Villa Allende" in respuesta.json()["detail"]
    assert almacen.objetos == {}
    with base_limpia.connect() as c:
        assert c.execute(text("SELECT count(*) FROM reclamo")).scalar_one() == 0


def test_it06_el_sexto_reclamo_del_dia_responde_429(vecina: TestClient) -> None:
    codigos = [reclamar(vecina).status_code for _ in range(6)]

    assert codigos == [201] * 5 + [429]


@pytest.mark.parametrize(
    ("cambio", "foto"),
    [
        ({"gravedad": 11}, None),
        ({"gravedad": 0}, None),
        ({"titulo": ""}, None),
        ({"titulo": "x" * 81}, None),
        ({"tipo_id": 999}, None),
        ({}, b"no es una imagen"),
    ],
    ids=[
        "gravedad-11",
        "gravedad-0",
        "sin-titulo",
        "titulo-largo",
        "tipo-inexistente",
        "foto-rota",
    ],
)
def test_datos_invalidos_responden_422_sin_guardar_nada(
    vecina: TestClient, almacen: AlmacenEnMemoria, cambio: dict[str, Any], foto: bytes | None
) -> None:
    assert reclamar(vecina, foto=foto, **cambio).status_code == 422
    assert almacen.objetos == {}


def test_rn09_sin_email_verificado_no_puede_reclamar(
    cliente_con_almacen: TestClient, base_limpia: Engine
) -> None:
    crear_usuario(base_limpia, "30999888", "sin-verificar@ejemplo.com", verificado=False)
    ingresar(cliente_con_almacen, "30999888")  # 403 al ingresar: no hay sesión

    assert reclamar(cliente_con_almacen).status_code == 401


def test_sin_sesion_no_se_puede_reclamar_ni_ver(cliente_con_almacen: TestClient) -> None:
    assert reclamar(cliente_con_almacen).status_code == 401
    assert cliente_con_almacen.get("/reclamos/1").status_code == 401


def test_reclamo_inexistente_responde_404(vecina: TestClient) -> None:
    assert vecina.get("/reclamos/12345").status_code == 404


def test_las_fotos_van_a_un_bucket_s3_real() -> None:
    """Contra RustFS (local y CI): mismo código que con el Railway Bucket."""
    settings = Settings()
    if not settings.aws_access_key_id:
        pytest.skip("Sin credenciales de S3 (AWS_ACCESS_KEY_ID)")
    almacen = AlmacenS3(settings)
    with contextlib.suppress(almacen.cliente.exceptions.BucketAlreadyOwnedByYou):
        almacen.cliente.create_bucket(Bucket=settings.aws_s3_bucket_name)
    clave = f"pruebas/{uuid.uuid4()}.jpg"

    almacen.guardar(clave, b"contenido", "image/jpeg")
    url = almacen.url_firmada(clave)
    objeto = almacen.cliente.get_object(Bucket=settings.aws_s3_bucket_name, Key=clave)
    almacen.borrar(clave)

    assert objeto["Body"].read() == b"contenido"
    assert objeto["ContentType"] == "image/jpeg"
    assert "X-Amz-Signature" in url

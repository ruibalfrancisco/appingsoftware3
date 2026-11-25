"""Back office municipal contra PostgreSQL + PostGIS real (IT-07, IT-08, CU-07 a CU-10)."""

import io
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app import municipales
from app.almacenamiento import AlmacenEnMemoria
from tests.integracion.conftest import CLAVE_DE_PRUEBA, crear_usuario, ingresar
from tests.integracion.test_reclamos_api import foto_con_exif, reclamar

ANA, BETO, OPERADORA = "30111222", "30222333", "20999888"
ALUMBRADO, OBRAS = 1, 2
BACHE, LUMINARIA = 1, 2


@pytest.fixture
def municipio(cliente_con_almacen: TestClient, base_limpia: Engine) -> TestClient:
    """Dos vecinos y una operadora; se cambia de uno a otro con ingresar(cliente, dni)."""
    crear_usuario(base_limpia, ANA, "ana@ejemplo.com")
    crear_usuario(base_limpia, BETO, "beto@ejemplo.com")
    crear_usuario(base_limpia, OPERADORA, "operadora@villaallende.gob.ar", rol="operador")
    ingresar(cliente_con_almacen, ANA)
    return cliente_con_almacen


def cambiar(cliente: TestClient, numero: int, estado: str, **datos: Any) -> Any:
    foto = datos.pop("foto", None)
    return cliente.post(
        f"/gestion/reclamos/{numero}/estado",
        data={"estado": estado, **datos},
        files={"foto": ("despues.jpg", foto, "image/jpeg")} if foto else None,
    )


def tablero(cliente: TestClient, **filtros: Any) -> list[int]:
    return [r["numero"] for r in cliente.get("/gestion/reclamos", params=filtros).json()]


def test_it07_un_vecino_no_entra_al_back_office_ni_cambia_estados(municipio: TestClient) -> None:
    numero = reclamar(municipio).json()["numero"]

    assert municipio.get("/gestion/reclamos").status_code == 403
    assert municipio.get(f"/gestion/reclamos/{numero}").status_code == 403
    respuesta = cambiar(municipio, numero, "EN_REVISION")
    assert respuesta.status_code == 403
    assert municipio.get(f"/reclamos/{numero}").json()["estado"] == "PENDIENTE"


def test_sin_sesion_el_back_office_responde_401(cliente: TestClient) -> None:
    assert cliente.get("/gestion/reclamos").status_code == 401


def test_cu07_tablero_de_mayor_a_menor_prioridad_y_a_igual_el_mas_antiguo(
    municipio: TestClient, base_limpia: Engine
) -> None:
    leve = reclamar(municipio, gravedad=3).json()["numero"]
    grave_viejo = reclamar(municipio, gravedad=8, latitud=-31.2950).json()["numero"]
    grave_nuevo = reclamar(municipio, gravedad=8, latitud=-31.2960).json()["numero"]
    apoyado = reclamar(municipio, gravedad=6, latitud=-31.2970).json()["numero"]
    ingresar(municipio, BETO)
    municipio.post(f"/reclamos/{apoyado}/apoyos", json={"gravedad": 6})  # prioridad 12
    with base_limpia.begin() as c:
        c.execute(
            text("UPDATE reclamo SET creado_en = creado_en - interval '1 day' WHERE id = :id"),
            {"id": grave_viejo},
        )

    ingresar(municipio, OPERADORA)
    filas = municipio.get("/gestion/reclamos").json()

    assert [f["numero"] for f in filas] == [apoyado, grave_viejo, grave_nuevo, leve]
    assert filas[0]["prioridad"] == 12
    assert filas[0]["cantidad_apoyos"] == 2
    assert filas[0]["foto_url"].startswith("https://fotos.example/reclamos/")
    assert {"dni", "email"}.isdisjoint(filas[0])  # RNF-08


def test_cu07_filtros_por_tipo_estado_area_y_fecha(
    municipio: TestClient, base_limpia: Engine
) -> None:
    bache = reclamar(municipio).json()["numero"]
    luminaria = reclamar(municipio, tipo_id=LUMINARIA).json()["numero"]
    viejo = reclamar(municipio, latitud=-31.2960).json()["numero"]
    resuelto = reclamar(municipio, latitud=-31.2970).json()["numero"]
    with base_limpia.begin() as c:
        c.execute(
            text("UPDATE reclamo SET creado_en = '2026-11-01T12:00:00-03:00' WHERE id = :id"),
            {"id": viejo},
        )
        c.execute(
            text("UPDATE reclamo SET estado = 'RESUELTO', area_id = 2 WHERE id = :id"),
            {"id": resuelto},
        )
        c.execute(text("UPDATE reclamo SET area_id = 1 WHERE id = :id"), {"id": luminaria})
    ingresar(municipio, OPERADORA)

    assert set(tablero(municipio)) == {bache, luminaria, viejo}  # sin filtro: los abiertos
    assert tablero(municipio, tipo_id=LUMINARIA) == [luminaria]
    assert tablero(municipio, estado="RESUELTO") == [resuelto]
    assert set(tablero(municipio, estado=["PENDIENTE", "RESUELTO"])) == {
        bache, luminaria, viejo, resuelto,
    }  # fmt: skip
    assert tablero(municipio, area_id=ALUMBRADO) == [luminaria]
    assert tablero(municipio, desde="2026-11-01", hasta="2026-11-01") == [viejo]
    assert viejo not in tablero(municipio, desde="2026-11-02")
    assert municipio.get("/gestion/reclamos", params={"estado": "INVENTADO"}).status_code == 422


def test_cu08_recorrido_completo_hasta_resuelto_con_foto_del_despues(
    municipio: TestClient, almacen: AlmacenEnMemoria, base_limpia: Engine
) -> None:
    numero = reclamar(municipio).json()["numero"]
    ingresar(municipio, OPERADORA)

    revision = cambiar(municipio, numero, "EN_REVISION", comentario="Lo vamos a mirar")
    assert revision.status_code == 200, revision.text
    assert revision.json()["transiciones"] == ["EN_PROCESO", "RECHAZADO"]
    sin_area = cambiar(municipio, numero, "EN_PROCESO")
    assert sin_area.status_code == 422
    assert "área" in sin_area.json()["detail"]
    assert cambiar(municipio, numero, "EN_PROCESO", area_id=OBRAS).status_code == 200
    sin_comentario = cambiar(municipio, numero, "RESUELTO")
    assert sin_comentario.status_code == 422
    resuelto = cambiar(
        municipio, numero, "RESUELTO", comentario="Bacheado y señalizado", foto=foto_con_exif()
    )
    assert resuelto.status_code == 200, resuelto.text
    assert resuelto.json()["transiciones"] == []

    detalle = municipio.get(f"/gestion/reclamos/{numero}").json()
    assert detalle["estado"] == "RESUELTO"
    assert detalle["area"] == {"id": OBRAS, "nombre": "Obras Públicas"}
    assert detalle["cerrado_en"] is not None
    assert [(h["estado_nuevo"], h["autor"]) for h in detalle["historial"]] == [
        ("PENDIENTE", "Vecino"),
        ("EN_REVISION", "Vecina De Prueba"),
        ("EN_PROCESO", "Vecina De Prueba"),
        ("RESUELTO", "Vecina De Prueba"),
    ]
    assert [f["tipo"] for f in detalle["fotos"]] == ["reporte", "resolucion"]
    assert any(clave.endswith("-resolucion.jpg") for clave in almacen.objetos)

    # El vecino ve el resultado y el comentario, pero no quién lo cambió (RF-22).
    ingresar(municipio, ANA)
    publico = municipio.get(f"/reclamos/{numero}").json()
    assert publico["estado"] == "RESUELTO"
    assert publico["area"] == "Obras Públicas"
    assert publico["historial"][-1]["comentario"] == "Bacheado y señalizado"
    assert "autor" not in publico["historial"][-1]
    assert [f["tipo"] for f in publico["fotos"]] == ["reporte", "resolucion"]


def test_rn05_transiciones_no_permitidas_responden_409(municipio: TestClient) -> None:
    numero = reclamar(municipio).json()["numero"]
    ingresar(municipio, OPERADORA)

    assert cambiar(municipio, numero, "RESUELTO", comentario="Listo").status_code == 409
    assert cambiar(municipio, numero, "RECHAZADO", motivo="x").status_code == 422  # sin motivo
    assert cambiar(municipio, numero, "RECHAZADO", comentario="Es privado").status_code == 200
    # Rechazado es final.
    assert cambiar(municipio, numero, "EN_REVISION").status_code == 409


def test_la_foto_del_despues_solo_va_al_resolver(
    municipio: TestClient, almacen: AlmacenEnMemoria
) -> None:
    numero = reclamar(municipio).json()["numero"]
    antes = set(almacen.objetos)
    ingresar(municipio, OPERADORA)

    respuesta = cambiar(municipio, numero, "EN_REVISION", foto=foto_con_exif())

    assert respuesta.status_code == 422
    assert set(almacen.objetos) == antes


def test_area_inexistente_responde_422(municipio: TestClient) -> None:
    numero = reclamar(municipio).json()["numero"]
    ingresar(municipio, OPERADORA)
    cambiar(municipio, numero, "EN_REVISION")

    assert cambiar(municipio, numero, "EN_PROCESO", area_id=99).status_code == 422


def test_it08_cada_cambio_genera_novedades_para_el_creador_y_los_que_apoyaron(
    municipio: TestClient, base_limpia: Engine
) -> None:
    numero = reclamar(municipio).json()["numero"]
    ingresar(municipio, BETO)
    municipio.post(f"/reclamos/{numero}/apoyos", json={"gravedad": 9})
    ingresar(municipio, OPERADORA)

    revision = cambiar(municipio, numero, "EN_REVISION")
    rechazo = cambiar(municipio, numero, "RECHAZADO", comentario="Es una calle privada")

    assert revision.json()["notificados"] == 2
    assert rechazo.json()["notificados"] == 2
    with base_limpia.connect() as c:
        novedades = c.execute(
            text(
                "SELECT u.dni, h.estado_nuevo, n.leida_en FROM notificacion n"
                " JOIN usuario u ON u.id = n.usuario_id"
                " JOIN historial_estado h ON h.id = n.historial_id"
                " WHERE n.reclamo_id = :id ORDER BY h.id, u.dni"
            ),
            {"id": numero},
        ).all()
    assert novedades == [
        (ANA, "EN_REVISION", None),
        (BETO, "EN_REVISION", None),
        (ANA, "RECHAZADO", None),
        (BETO, "RECHAZADO", None),
    ]


def test_detalle_de_gestion_ofrece_las_transiciones_y_responde_404(
    municipio: TestClient,
) -> None:
    numero = reclamar(municipio).json()["numero"]
    ingresar(municipio, OPERADORA)

    detalle = municipio.get(f"/gestion/reclamos/{numero}").json()

    assert detalle["transiciones"] == ["EN_REVISION", "RECHAZADO"]
    assert detalle["area"] is None
    assert municipio.get("/gestion/reclamos/12345").status_code == 404
    assert [a["nombre"] for a in municipio.get("/gestion/areas").json()] == [
        "Alumbrado", "Obras Públicas", "Tránsito", "Higiene Urbana",
    ]  # fmt: skip


def test_cu10_alta_de_operador_con_clave_inicial_y_baja(
    cliente: TestClient, base_limpia: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("CLAVE_INICIAL", CLAVE_DE_PRUEBA)
    salida = io.StringIO()

    codigo = municipales.main(
        [
            "--dni",
            "20.111.222",
            "--email",
            "Ana@VillaAllende.gob.ar",
            "--nombre",
            "Ana",
            "--apellido",
            "Pérez",
            "--rol",
            "operador",
        ],
        salida,
    )

    assert codigo == 0
    assert "es operador" in salida.getvalue()
    ingreso = cliente.post(
        "/auth/ingreso", json={"identificador": "20111222", "password": CLAVE_DE_PRUEBA}
    )
    assert ingreso.status_code == 200
    assert ingreso.json()["rol"] == "operador"
    assert cliente.get("/gestion/reclamos").status_code == 200

    assert municipales.main(["--dni", "20111222", "--desactivar"], io.StringIO()) == 0
    assert cliente.get("/gestion/reclamos").status_code == 401  # sesión cerrada
    otra = cliente.post(
        "/auth/ingreso", json={"identificador": "20111222", "password": CLAVE_DE_PRUEBA}
    )
    assert otra.status_code == 401


def test_cu10_sin_clave_inicial_imprime_un_enlace_para_elegirla(
    cliente: TestClient, base_limpia: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("CLAVE_INICIAL", raising=False)
    salida = io.StringIO()
    municipales.main(
        [
            "--dni",
            "20333444",
            "--email",
            "admin@villaallende.gob.ar",
            "--nombre",
            "Luis",
            "--apellido",
            "Gómez",
            "--rol",
            "admin",
        ],
        salida,
    )
    token = salida.getvalue().split("token=")[1].strip()

    respuesta = cliente.post(
        "/auth/restablecer", json={"token": token, "password": "una-clave-nueva-1"}
    )

    assert respuesta.status_code == 200, respuesta.text
    ingreso = cliente.post(
        "/auth/ingreso", json={"identificador": "20333444", "password": "una-clave-nueva-1"}
    )
    assert ingreso.json()["rol"] == "admin"

"""CU-05 Apoyar un reclamo existente contra PostgreSQL + PostGIS real (IT-02, IT-03, IT-04)."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from tests.integracion.conftest import crear_usuario, ingresar
from tests.integracion.test_reclamos_api import CENTRO, reclamar

BACHE, LUMINARIA, SEMAFORO = 1, 2, 5


def a_metros(motor: Engine, metros: float, *, rumbo_grados: float = 0) -> dict[str, float]:
    """El punto que está exactamente a `metros` de CENTRO, calculado por PostGIS."""
    with motor.connect() as c:
        latitud, longitud = c.execute(
            text(
                "SELECT ST_Y(p::geometry), ST_X(p::geometry) FROM ST_Project("
                "  ST_GeogFromText(:centro), :metros, radians(:rumbo)) AS p"
            ),
            {
                "centro": f"POINT({CENTRO['longitud']} {CENTRO['latitud']})",
                "metros": metros,
                "rumbo": rumbo_grados,
            },
        ).one()
    return {"latitud": latitud, "longitud": longitud}


def similares(cliente: TestClient, tipo_id: int = BACHE, **punto: float) -> Any:
    return cliente.get("/reclamos/similares", params={"tipo_id": tipo_id, **(punto or CENTRO)})


def apoyar(cliente: TestClient, numero: int, gravedad: int = 7) -> Any:
    return cliente.post(f"/reclamos/{numero}/apoyos", json={"gravedad": gravedad})


@pytest.fixture
def vecinos(cliente_con_almacen: TestClient, base_limpia: Engine) -> TestClient:
    """Tres vecinos verificados; se cambia de uno a otro con ingresar(cliente, dni)."""
    for dni, email in [
        ("30111222", "ana@ejemplo.com"),
        ("30222333", "beto@ejemplo.com"),
        ("30333444", "carla@ejemplo.com"),
    ]:
        crear_usuario(base_limpia, dni, email)
    ingresar(cliente_con_almacen, "30111222")
    return cliente_con_almacen


ANA, BETO, CARLA = "30111222", "30222333", "30333444"


def test_it02_similares_a_49_m_si_a_51_m_no_ni_otros_tipos_ni_cerrados(
    vecinos: TestClient, base_limpia: Engine
) -> None:
    a_49 = reclamar(vecinos, **a_metros(base_limpia, 49)).json()["numero"]
    reclamar(vecinos, **a_metros(base_limpia, 51))
    reclamar(vecinos, tipo_id=LUMINARIA)  # otro tipo, en el mismo punto
    cerrado = reclamar(vecinos).json()["numero"]
    with base_limpia.begin() as c:
        c.execute(text("UPDATE reclamo SET estado = 'RESUELTO' WHERE id = :id"), {"id": cerrado})

    ingresar(vecinos, BETO)
    encontrados = similares(vecinos).json()

    assert [r["numero"] for r in encontrados] == [a_49]
    assert encontrados[0]["distancia_m"] == 49
    assert encontrados[0]["cantidad_apoyos"] == 1
    assert encontrados[0]["foto_url"].startswith("https://fotos.example/reclamos/")
    assert encontrados[0]["es_propio"] is False
    assert encontrados[0]["ya_apoyado"] is False
    assert "30111222" not in str(encontrados)  # RNF-08


def test_rn01_hasta_5_similares_del_mas_cercano_al_mas_lejano(
    vecinos: TestClient, base_limpia: Engine
) -> None:
    numeros = []
    for i, metros in enumerate([40, 5, 30, 20, 45, 10]):
        ingresar(vecinos, ANA if i < 3 else BETO)  # RN-08: 5 por vecino y por día
        numeros.append(reclamar(vecinos, **a_metros(base_limpia, metros)).json()["numero"])

    ingresar(vecinos, CARLA)
    encontrados = similares(vecinos).json()

    assert [r["distancia_m"] for r in encontrados] == [5, 10, 20, 30, 40]
    assert len(encontrados) == 5


def test_similares_marca_los_propios_y_los_ya_apoyados(vecinos: TestClient) -> None:
    de_ana = reclamar(vecinos).json()["numero"]
    ingresar(vecinos, BETO)
    de_beto = reclamar(vecinos).json()["numero"]
    apoyar(vecinos, de_ana)

    marcas = {r["numero"]: (r["es_propio"], r["ya_apoyado"]) for r in similares(vecinos).json()}

    assert marcas == {de_ana: (False, True), de_beto: (True, False)}


def test_cu05_apoyar_suma_el_apoyo_y_recalcula_la_prioridad(
    vecinos: TestClient, base_limpia: Engine
) -> None:
    numero = reclamar(vecinos, gravedad=5).json()["numero"]
    ingresar(vecinos, BETO)

    respuesta = apoyar(vecinos, numero, gravedad=7)

    assert respuesta.status_code == 201, respuesta.text
    # RN-04: promedio 6 con 2 vecinos → 6 × (1 + log2 2) = 12
    assert respuesta.json() == {
        "numero": numero,
        "cantidad_apoyos": 2,
        "gravedad_promedio": 6,
        "prioridad": 12,
    }
    detalle = vecinos.get(f"/reclamos/{numero}").json()
    assert (detalle["cantidad_apoyos"], detalle["prioridad"]) == (2, 12)
    with base_limpia.connect() as c:
        apoyos = c.execute(
            text("SELECT gravedad, es_creador FROM apoyo WHERE reclamo_id = :id ORDER BY id"),
            {"id": numero},
        ).all()
    assert apoyos == [(5, True), (7, False)]


def test_rn04_tabla_semaforo_roto_3_vecinos_con_gravedad_9_da_23_3(vecinos: TestClient) -> None:
    numero = reclamar(vecinos, tipo_id=SEMAFORO, gravedad=9).json()["numero"]
    for dni in (BETO, CARLA):
        ingresar(vecinos, dni)
        assert apoyar(vecinos, numero, gravedad=9).status_code == 201

    detalle = vecinos.get(f"/reclamos/{numero}").json()

    assert detalle["cantidad_apoyos"] == 3
    assert detalle["prioridad"] == pytest.approx(23.3, abs=0.05)


def test_it03_apoyar_dos_veces_responde_409_y_la_base_no_suma(
    vecinos: TestClient, base_limpia: Engine
) -> None:
    numero = reclamar(vecinos).json()["numero"]
    ingresar(vecinos, BETO)
    assert apoyar(vecinos, numero).status_code == 201

    segunda = apoyar(vecinos, numero, gravedad=10)

    assert segunda.status_code == 409
    assert segunda.json()["detail"] == "Ya apoyaste este reclamo"
    with base_limpia.connect() as c:
        cantidad = c.execute(
            text("SELECT count(*) FROM apoyo WHERE reclamo_id = :id"), {"id": numero}
        ).scalar_one()
        guardada = c.execute(
            text("SELECT cantidad_apoyos FROM reclamo WHERE id = :id"), {"id": numero}
        ).scalar_one()
    assert (cantidad, guardada) == (2, 2)


def test_it04_apoyar_el_propio_reclamo_responde_409(vecinos: TestClient) -> None:
    numero = reclamar(vecinos).json()["numero"]

    respuesta = apoyar(vecinos, numero)

    assert respuesta.status_code == 409
    assert "Es tu reclamo" in respuesta.json()["detail"]
    assert vecinos.get(f"/reclamos/{numero}").json()["cantidad_apoyos"] == 1


def test_un_reclamo_cerrado_no_suma_apoyos(vecinos: TestClient, base_limpia: Engine) -> None:
    numero = reclamar(vecinos).json()["numero"]
    with base_limpia.begin() as c:
        c.execute(text("UPDATE reclamo SET estado = 'RECHAZADO' WHERE id = :id"), {"id": numero})
    ingresar(vecinos, BETO)

    assert apoyar(vecinos, numero).status_code == 409


def test_rn08_los_apoyos_no_cuentan_para_el_limite_diario(vecinos: TestClient) -> None:
    de_ana = reclamar(vecinos).json()["numero"]
    ingresar(vecinos, BETO)
    assert [reclamar(vecinos).status_code for _ in range(5)] == [201] * 5

    assert apoyar(vecinos, de_ana).status_code == 201


@pytest.mark.parametrize("gravedad", [0, 11])
def test_rn03_gravedad_invalida_responde_422(vecinos: TestClient, gravedad: int) -> None:
    numero = reclamar(vecinos).json()["numero"]
    ingresar(vecinos, BETO)

    assert apoyar(vecinos, numero, gravedad=gravedad).status_code == 422


def test_apoyar_un_reclamo_inexistente_responde_404(vecinos: TestClient) -> None:
    assert apoyar(vecinos, 12345).status_code == 404


def test_sin_sesion_no_hay_similares_ni_apoyos(cliente_con_almacen: TestClient) -> None:
    assert similares(cliente_con_almacen).status_code == 401
    assert apoyar(cliente_con_almacen, 1).status_code == 401

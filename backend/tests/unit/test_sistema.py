import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.build_info import obtener_build_info
from app.config import Settings
from app.main import app


def test_health_responde_ok_con_version_y_ambiente() -> None:
    respuesta = TestClient(app).get("/health")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["status"] == "ok"
    assert set(cuerpo) == {"status", "version", "commit", "ambiente"}


def test_cors_permite_el_frontend_y_rechaza_otros_origenes() -> None:
    cliente = TestClient(app)

    permitido = cliente.get("/health", headers={"Origin": "http://localhost:5173"})
    ajeno = cliente.get("/health", headers={"Origin": "https://sitio-ajeno.example"})

    assert permitido.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in ajeno.headers


def test_build_info_lee_el_archivo_del_pipeline(tmp_path: Path) -> None:
    ruta = tmp_path / "build_info.json"
    ruta.write_text(json.dumps({"version": "1.2.3", "commit": "abc1234"}), encoding="utf-8")

    info = obtener_build_info.__wrapped__(ruta)

    assert (info.version, info.commit) == ("1.2.3", "abc1234")


def test_build_info_sin_archivo_usa_valores_de_desarrollo(tmp_path: Path) -> None:
    info = obtener_build_info.__wrapped__(tmp_path / "no-existe.json")

    assert (info.version, info.commit) == ("0.0.0-dev", "local")


def test_convierte_la_url_de_railway_para_psycopg() -> None:
    railway = Settings(database_url="postgresql://u:p@host:5432/db")
    heroku = Settings(database_url="postgres://u:p@host:5432/db")

    assert railway.sqlalchemy_database_url == "postgresql+psycopg://u:p@host:5432/db"
    assert heroku.sqlalchemy_database_url == "postgresql+psycopg://u:p@host:5432/db"


def test_lista_de_origenes_cors() -> None:
    settings = Settings(cors_origins=" https://a.example ,https://b.example,, ")

    assert settings.lista_cors_origins == ["https://a.example", "https://b.example"]


def test_en_railway_la_api_no_arranca_sin_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(railway_environment_name="production")
    with pytest.raises(ValidationError, match="32 caracteres"):
        Settings(railway_environment_name="staging", jwt_secret="corto")


def test_en_railway_la_cookie_es_segura_y_en_local_no() -> None:
    railway = Settings(railway_environment_name="staging", jwt_secret="x" * 64)

    assert railway.cookie_segura
    assert not Settings().cookie_segura


def test_resend_necesita_api_key() -> None:
    with pytest.raises(ValidationError, match="RESEND_API_KEY"):
        Settings(email_backend="resend")

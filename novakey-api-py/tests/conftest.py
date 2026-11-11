"""Fixtures de pruebas de integración.

Requieren un PostgreSQL accesible en ``NOVAKEY_DB_URL`` (CI levanta postgres:16-alpine).
Cada prueba corre sobre el esquema migrado con Alembic y los datos de demostración reiniciados.
"""

import os

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

# Fija el perfil demo y un secreto válido antes de importar la app.
os.environ.setdefault("NOVAKEY_PERFIL", "demo")
os.environ.setdefault("NOVAKEY_JWT_SECRETO", "secreto-de-pruebas-con-mas-de-treinta-y-dos-bytes")


def _hay_base_de_datos() -> bool:
    """Comprueba rápidamente si la base de datos configurada acepta conexiones.

    Permite que las pruebas de integración se omitan (en vez de colgarse) cuando no hay
    PostgreSQL disponible, p. ej. en un entorno de desarrollo sin Docker.
    """
    from novakey.config import get_settings

    engine = create_engine(get_settings().db_url, connect_args={"connect_timeout": 3})
    try:
        with engine.connect():
            return True
    except Exception:
        return False
    finally:
        engine.dispose()


requiere_bd = pytest.mark.skipif(
    not _hay_base_de_datos(), reason="No hay PostgreSQL disponible en NOVAKEY_DB_URL"
)


def _migrar() -> None:
    cfg = Config("alembic.ini")
    command.upgrade(cfg, "head")


@pytest.fixture(scope="session", autouse=True)
def esquema():
    """Aplica las migraciones una vez por sesión, solo si hay base de datos."""
    if _hay_base_de_datos():
        _migrar()
    yield


@pytest.fixture
def cliente():
    from novakey.main import crear_app

    with TestClient(crear_app()) as c:
        yield c


@pytest.fixture
def token(cliente):
    """Devuelve una función que obtiene el token de un usuario demo (clave 'novakey')."""

    def _token(username: str) -> str:
        r = cliente.post("/api/auth/login", json={"username": username, "password": "novakey"})
        assert r.status_code == 200, r.text
        return r.json()["token"]

    return _token


@pytest.fixture
def auth():
    def _auth(tok: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {tok}"}

    return _auth

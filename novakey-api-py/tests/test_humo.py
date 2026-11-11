"""Pruebas de humo del esqueleto: la app arranca, health responde y la seguridad base funciona.

Estas pruebas no requieren base de datos; validan el andamiaje antes de añadir módulos.
"""

from fastapi.testclient import TestClient

from novakey.comun.seguridad import (
    emitir_token,
    hash_clave,
    leer_token,
    verificar_clave,
)
from novakey.main import crear_app

cliente = TestClient(crear_app())


def test_health_responde_up():
    r = cliente.get("/actuator/health")
    assert r.status_code == 200
    assert r.json() == {"status": "UP"}


def test_hash_argon2_verifica_y_no_expone_la_clave():
    h = hash_clave("clave-larga-de-prueba")
    assert h.startswith("$argon2")
    assert "clave-larga-de-prueba" not in h
    assert verificar_clave("clave-larga-de-prueba", h)
    assert not verificar_clave("otra-clave", h)


def test_token_ida_y_vuelta():
    token, _expira = emitir_token(42)
    assert leer_token(token) == 42

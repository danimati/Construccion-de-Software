"""Pruebas de integración de la API externa de la tienda (RF06)."""

from sqlalchemy import create_engine, text

from novakey.config import get_settings
from tests.conftest import requiere_bd

pytestmark = requiere_bd

API_KEY = "clave-tienda-demo"  # valor por defecto del perfil demo


def _stock_producto(sku: str) -> int:
    engine = create_engine(get_settings().db_url)
    with engine.connect() as c:
        return int(
            c.execute(
                text("select stock_actual from producto where sku = :s"), {"s": sku}
            ).scalar()
        )


def _reiniciar(cliente, auth, admin):
    assert cliente.post("/api/demo/reiniciar", headers=auth(admin)).status_code == 200


def _key(valor=API_KEY):
    return {"X-API-Key": valor}


def test_catalogo_exige_api_key(cliente):
    assert cliente.get("/api/tienda/catalogo").status_code == 401
    assert cliente.get("/api/tienda/catalogo", headers=_key("mala")).status_code == 401
    r = cliente.get("/api/tienda/catalogo", headers=_key())
    assert r.status_code == 200
    skus = {p["sku"] for p in r.json()}
    assert "NK-TEC-75" in skus
    # El catálogo no expone datos internos como el stock mínimo o el costo.
    assert set(r.json()[0].keys()) == {"sku", "nombre", "precio_venta", "disponible"}


def test_registrar_pedido_web_descuenta_stock(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    antes = _stock_producto("NK-TEC-75")

    pedido = {
        "cliente": {"documento": "TIENDA-001", "nombre": "Cliente Web"},
        "lineas": [{"sku": "NK-TEC-75", "cantidad": 3}],
    }
    r = cliente.post("/api/tienda/pedidos", json=pedido, headers=_key())
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["canal"] == "web"
    assert cuerpo["estado"] == "confirmado"
    assert float(cuerpo["total"]) == 3 * 690000
    assert _stock_producto("NK-TEC-75") == antes - 3

    # El pedido web aparece en la lista interna de ventas con su canal.
    comercial = token("ecampos")
    pedidos = cliente.get("/api/pedidos", headers=auth(comercial)).json()
    assert any(p["id"] == cuerpo["pedido_id"] and p["canal"] == "web" for p in pedidos)


def test_pedido_web_sin_disponibilidad_se_rechaza(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    antes = _stock_producto("NK-TEC-60")  # 12 en el demo

    pedido = {
        "cliente": {"documento": "TIENDA-002", "nombre": "Otro Web"},
        "lineas": [{"sku": "NK-TEC-60", "cantidad": 99}],
    }
    r = cliente.post("/api/tienda/pedidos", json=pedido, headers=_key())
    assert r.status_code == 409
    assert _stock_producto("NK-TEC-60") == antes  # nada se descontó


def test_pedido_web_sku_inexistente(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    pedido = {
        "cliente": {"documento": "TIENDA-003", "nombre": "Web"},
        "lineas": [{"sku": "NO-EXISTE", "cantidad": 1}],
    }
    r = cliente.post("/api/tienda/pedidos", json=pedido, headers=_key())
    assert r.status_code == 404

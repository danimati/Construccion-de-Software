"""Pruebas de integración del módulo Ventas (RF04). Equivalen a las de la versión Spring."""

from sqlalchemy import create_engine, text

from novakey.config import get_settings
from tests.conftest import requiere_bd

pytestmark = requiere_bd


def _stock_producto(pid: int) -> int:
    engine = create_engine(get_settings().db_url)
    with engine.connect() as c:
        return int(
            c.execute(
                text("select stock_actual from producto where id_producto = :p"), {"p": pid}
            ).scalar()
        )


def _contar(sql: str, **p) -> int:
    engine = create_engine(get_settings().db_url)
    with engine.connect() as c:
        return int(c.execute(text(sql), p).scalar())


def _reiniciar(cliente, auth, admin):
    assert cliente.post("/api/demo/reiniciar", headers=auth(admin)).status_code == 200


def test_cotizacion_pedido_y_factura_con_iva(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    comercial = token("ecampos")

    # Cotización 2: 5 unidades del producto 1. Convertir a pedido descuenta stock (48 -> 43).
    r = cliente.post("/api/cotizaciones/2/pedido", headers=auth(comercial))
    assert r.status_code == 201, r.text
    pedido = r.json()["id"]
    assert _stock_producto(1) == 43

    r = cliente.post(f"/api/pedidos/{pedido}/factura", headers=auth(comercial))
    assert r.status_code == 201
    f = r.json()
    assert f["numero"] == "FAC-0002"
    assert float(f["subtotal"]) == 3450000
    assert float(f["impuestos"]) == 655500  # 19 %
    assert float(f["total"]) == 4105500

    # Un pedido ya facturado no se vuelve a facturar.
    r = cliente.post(f"/api/pedidos/{pedido}/factura", headers=auth(comercial))
    assert r.status_code == 409


def test_sin_disponibilidad_se_deshace_todo_el_pedido(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    comercial = token("ecampos")

    pedidos_antes = _contar("select count(*) from pedido")
    cuerpo = {
        "cliente_id": 1,
        "lineas": [
            {"producto_id": 1, "cantidad": 1, "precio_unitario": 690000},
            {"producto_id": 2, "cantidad": 13, "precio_unitario": 590000},  # solo hay 12
        ],
    }
    r = cliente.post("/api/pedidos", json=cuerpo, headers=auth(comercial))
    assert r.status_code == 409
    assert "disponibles 12" in r.json()["detail"]
    # Nada se descontó ni se creó.
    assert _stock_producto(1) == 48
    assert _contar("select count(*) from pedido") == pedidos_antes


def test_cancelar_pedido_devuelve_stock(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    comercial = token("ecampos")

    # El pedido 3 (en_preparacion) tiene 10 unidades del producto 1.
    assert cliente.post("/api/pedidos/3/cancelar", headers=auth(comercial)).status_code == 200
    assert _stock_producto(1) == 58  # 48 + 10 devueltas
    # Un pedido cancelado no se factura.
    assert cliente.post("/api/pedidos/3/factura", headers=auth(comercial)).status_code == 409


def test_permisos_de_ventas(cliente, token, auth):
    compras = token("jsalcedo")
    assert cliente.get("/api/clientes", headers=auth(compras)).status_code == 403
    comercial = token("ecampos")
    assert cliente.get("/api/clientes", headers=auth(comercial)).status_code == 200
    # Gerencia solo ve (ventas:ver), no puede facturar.
    gerencia = token("mquintero")
    assert cliente.get("/api/facturas", headers=auth(gerencia)).status_code == 200
    assert cliente.post("/api/pedidos/2/factura", headers=auth(gerencia)).status_code == 403

"""Pruebas de integración del módulo Compras (RF03). Equivalen a las de la versión Spring."""

from sqlalchemy import create_engine, text

from novakey.config import get_settings
from tests.conftest import requiere_bd

pytestmark = requiere_bd


def _consulta(sql: str, **params):
    engine = create_engine(get_settings().db_url)
    with engine.connect() as c:
        return c.execute(text(sql), params).scalar()


def _stock_material(mid: int) -> float:
    return float(_consulta("select stock_actual from material where id_material = :m", m=mid))


def _linea_oc(orden: int) -> int:
    sql = "select id_detalle_oc from detalle_orden_compra where id_orden_compra = :o"
    return int(_consulta(sql, o=orden))


def _saldo(orden: int) -> float:
    sql = "select saldo from cuenta_por_pagar where id_orden_compra = :o"
    return float(_consulta(sql, o=orden))


def _reiniciar(cliente, auth, admin):
    assert cliente.post("/api/demo/reiniciar", headers=auth(admin)).status_code == 200


def test_recepcion_parcial_y_total_actualizan_stock_y_cuenta(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    compras = token("jsalcedo")
    linea = _linea_oc(3)

    r = cliente.post(
        "/api/ordenes-compra/3/recepciones",
        json={"cantidades": {str(linea): 50}},
        headers=auth(compras),
    )
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "parcial"
    assert _stock_material(5) == 146  # 96 + 50
    assert _saldo(3) == 2900000  # 50 * 58000

    r = cliente.post(
        "/api/ordenes-compra/3/recepciones",
        json={"cantidades": {str(linea): 100}},
        headers=auth(compras),
    )
    assert r.status_code == 200
    assert r.json()["estado"] == "recibida"
    assert _saldo(3) == 8700000  # 150 * 58000

    # Ya no admite más recepciones.
    r = cliente.post(
        "/api/ordenes-compra/3/recepciones",
        json={"cantidades": {str(linea): 1}},
        headers=auth(compras),
    )
    assert r.status_code == 409


def test_no_se_recibe_mas_de_lo_pendiente_ni_se_paga_mas_que_el_saldo(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    compras = token("jsalcedo")
    linea = _linea_oc(3)

    r = cliente.post(
        "/api/ordenes-compra/3/recepciones",
        json={"cantidades": {str(linea): 151}},
        headers=auth(compras),
    )
    assert r.status_code == 409
    assert _stock_material(5) == 96  # nada cambió

    # La cuenta 1 (OC-1) tiene saldo 8360000.
    r = cliente.post(
        "/api/cuentas-por-pagar/1/pagos", json={"monto": 8360001}, headers=auth(compras)
    )
    assert r.status_code == 409
    r = cliente.post(
        "/api/cuentas-por-pagar/1/pagos", json={"monto": 8360000}, headers=auth(compras)
    )
    assert r.status_code == 200
    assert r.json()["estado"] == "pagada"


def test_permisos_de_compras(cliente, token, auth):
    comercial = token("ecampos")
    assert cliente.get("/api/proveedores", headers=auth(comercial)).status_code == 403
    compras = token("jsalcedo")
    assert cliente.get("/api/proveedores", headers=auth(compras)).status_code == 200
    # Compras no edita ventas ni rh.
    assert cliente.get("/api/cuentas-por-pagar", headers=auth(compras)).status_code == 200


def test_crear_proveedor_rechaza_nit_repetido(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    compras = token("jsalcedo")
    nuevo = {"nit": "900000009-9", "razon_social": "Nueva S.A.S."}
    assert cliente.post("/api/proveedores", json=nuevo, headers=auth(compras)).status_code == 201
    assert cliente.post("/api/proveedores", json=nuevo, headers=auth(compras)).status_code == 409

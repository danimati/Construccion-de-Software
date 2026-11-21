"""Pruebas de integración del módulo Inventario y Producción (RF02).

Equivalen a las pruebas de producción e inventario de la versión Spring. Requieren PostgreSQL.
"""

from sqlalchemy import create_engine, text

from novakey.config import get_settings
from tests.conftest import requiere_bd

pytestmark = requiere_bd


def _stock_material(mid: int) -> float:
    engine = create_engine(get_settings().db_url)
    with engine.connect() as c:
        return float(
            c.execute(
                text("select stock_actual from material where id_material = :m"), {"m": mid}
            ).scalar()
        )


def _stock_producto(pid: int) -> int:
    engine = create_engine(get_settings().db_url)
    with engine.connect() as c:
        return int(
            c.execute(
                text("select stock_actual from producto where id_producto = :p"), {"p": pid}
            ).scalar()
        )


def _reiniciar(cliente, auth, admin):
    assert cliente.post("/api/demo/reiniciar", headers=auth(admin)).status_code == 200


def _crear_orden(cliente, auth, produccion, cantidad: int) -> int:
    r = cliente.post(
        "/api/ordenes-produccion",
        json={"producto_id": 1, "cantidad": cantidad},
        headers=auth(produccion),
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_iniciar_orden_consume_toda_la_lista(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    produccion = token("princon")
    oid = _crear_orden(cliente, auth, produccion, 10)
    r = cliente.post(f"/api/ordenes-produccion/{oid}/iniciar", headers=auth(produccion))
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["estado"] == "en_proceso"
    assert cuerpo["avance"][0] == 10
    assert _stock_material(1) == 410  # 420 - 10*1
    assert _stock_material(3) == 5360  # 6200 - 10*84


def test_falta_un_material_y_no_se_descuenta_ninguno(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    produccion = token("princon")
    oid = _crear_orden(cliente, auth, produccion, 65)  # solo hay 64 pantallas OLED
    r = cliente.post(f"/api/ordenes-produccion/{oid}/iniciar", headers=auth(produccion))
    assert r.status_code == 409
    assert "Pantalla OLED" in r.json()["detail"]
    assert _stock_material(1) == 420  # nada se descontó


def test_estaciones_respetan_el_orden_y_solo_suman_stock_las_aprobadas(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    produccion = token("princon")
    oid = _crear_orden(cliente, auth, produccion, 2)
    ruta = f"/api/ordenes-produccion/{oid}/avance"
    cab = auth(produccion)

    def avanzar(**cuerpo):
        return cliente.post(ruta, json=cuerpo, headers=cab)

    assert cliente.post(f"/api/ordenes-produccion/{oid}/iniciar", headers=cab).status_code == 200
    # No se puede avanzar a la estación 2 sin pasar la 1.
    assert avanzar(estacion=2).status_code == 409
    for estacion in (1, 2, 3):
        for _ in range(2):
            assert avanzar(estacion=estacion).status_code == 200
    # Calidad exige resultado.
    r = avanzar(estacion=4)
    assert r.status_code == 409
    assert "resultado" in r.json()["detail"]
    stock = _stock_producto(1)
    assert avanzar(estacion=4, resultado="aprobada").status_code == 200
    assert avanzar(estacion=4, resultado="rechazada").status_code == 200
    r = avanzar(estacion=5)
    assert r.status_code == 200
    assert r.json()["estado"] == "terminada"
    # Ya no quedan unidades aprobadas pendientes de empacar.
    assert avanzar(estacion=5).status_code == 409
    assert _stock_producto(1) == stock + 1  # solo la aprobada suma stock


def test_ajuste_no_deja_stock_negativo_y_queda_registrado(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    produccion = token("princon")
    r = cliente.post(
        "/api/movimientos/ajustes",
        json={"material_id": 5, "cantidad": -97, "motivo": "Conteo"},
        headers=auth(produccion),
    )
    assert r.status_code == 409  # solo hay 96
    r = cliente.post(
        "/api/movimientos/ajustes",
        json={"material_id": 5, "cantidad": -6, "motivo": "Conteo"},
        headers=auth(produccion),
    )
    assert r.status_code == 201
    assert _stock_material(5) == 90
    movs = cliente.get("/api/movimientos", headers=auth(produccion)).json()
    assert movs[0]["documento_ref"] == "Conteo"
    assert movs[0]["usuario"] == "princon"


def test_catalogos_respetan_permisos(cliente, token, auth):
    rh = token("nmedina")
    assert cliente.get("/api/materiales", headers=auth(rh)).status_code == 403
    comercial = token("ecampos")
    # Comercial tiene ventas:ver (productos) e inventario:ver (materiales).
    assert cliente.get("/api/productos", headers=auth(comercial)).status_code == 200
    assert cliente.get("/api/materiales", headers=auth(comercial)).status_code == 200

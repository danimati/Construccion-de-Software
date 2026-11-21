"""Pruebas de integración del módulo Recursos Humanos (RF05)."""

from sqlalchemy import create_engine, text

from novakey.config import get_settings
from tests.conftest import requiere_bd

pytestmark = requiere_bd


def _contar(sql: str, **p) -> int:
    engine = create_engine(get_settings().db_url)
    with engine.connect() as c:
        return int(c.execute(text(sql), p).scalar())


def _reiniciar(cliente, auth, admin):
    assert cliente.post("/api/demo/reiniciar", headers=auth(admin)).status_code == 200


def test_nomina_del_mes_siguiente_recalcula_el_neto(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    rh = token("nmedina")

    r = cliente.post("/api/nominas", headers=auth(rh))
    assert r.status_code == 201, r.text
    n = r.json()
    # El último periodo liquidado es octubre 2026, así que se genera noviembre 2026.
    assert n["periodo_inicio"] == "2026-11-01"
    assert n["periodo_fin"] == "2026-11-30"
    assert len(n["detalles"]) == 8  # ningún empleado retirado

    nomina = n["id"]
    detalle = next(d for d in n["detalles"] if d["empleado_id"] == 1)
    # Empleado 1: salario 9.500.000, deducción 8 % = 760.000. Con 100.000 devengados -> 8.840.000.
    r = cliente.put(
        f"/api/nominas/{nomina}/detalles/{detalle['id']}/devengados",
        json={"devengados": 100000},
        headers=auth(rh),
    )
    assert r.status_code == 200
    d1 = next(d for d in r.json()["detalles"] if d["empleado_id"] == 1)
    assert float(d1["neto_pagar"]) == 8840000.0

    # No se genera otra nómina mientras haya una en borrador.
    assert cliente.post("/api/nominas", headers=auth(rh)).status_code == 409
    # Tras pagar, ya no se editan sus devengados.
    assert cliente.post(f"/api/nominas/{nomina}/pagar", headers=auth(rh)).status_code == 200
    r = cliente.put(
        f"/api/nominas/{nomina}/detalles/{detalle['id']}/devengados",
        json={"devengados": 1},
        headers=auth(rh),
    )
    assert r.status_code == 409


def test_empleado_nuevo_recibe_horario_de_lunes_a_viernes(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    rh = token("nmedina")

    nuevo = {
        "cargo_id": 4,
        "documento": "777",
        "nombres": "Ana",
        "apellidos": "Prueba",
        "fecha_ingreso": "2026-11-04",
        "hora_inicio": "08:00",
        "hora_fin": "17:00",
    }
    assert cliente.post("/api/empleados", json=nuevo, headers=auth(rh)).status_code == 201
    assert (
        _contar(
            "select count(*) from horario h join empleado e using (id_empleado) "
            "where e.documento = '777'"
        )
        == 5
    )
    # Hora de inicio posterior a la de fin: rechazado.
    malo = {**nuevo, "documento": "778", "hora_inicio": "18:00", "hora_fin": "17:00"}
    assert cliente.post("/api/empleados", json=malo, headers=auth(rh)).status_code == 409


def test_la_sesion_muestra_el_nombre_real_del_empleado(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    # slinares está asociado al empleado 7 (Sara Linares) vía ConsultaEmpleados.
    r = cliente.get("/api/auth/me", headers=auth(token("slinares")))
    assert r.status_code == 200
    assert r.json()["nombre"] == "Sara Linares"


def test_permisos_de_rh(cliente, token, auth):
    comercial = token("ecampos")
    assert cliente.get("/api/empleados", headers=auth(comercial)).status_code == 403
    rh = token("nmedina")
    assert cliente.get("/api/empleados", headers=auth(rh)).status_code == 200
    # El resumen lo pueden ver tanto RH como Accesos.
    admin = token("slinares")
    assert cliente.get("/api/empleados/resumen", headers=auth(admin)).status_code == 200

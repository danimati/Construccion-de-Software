"""Datos de demostración del módulo Recursos Humanos (solo perfil ``demo``).

Siembra cargos, empleados, horarios y la nómina de ejemplo (octubre 2026, pagada), con los
valores del proyecto original. Las áreas son datos de referencia creados por la migración.
"""

from __future__ import annotations

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from novakey.rh.modelo import Empleado

# (id, area, nombre, salario_base)
_CARGOS = [
    (1, 1, "Gerente general", 9500000),
    (2, 2, "Analista de compras", 3400000),
    (3, 3, "Jefe de producción", 5200000),
    (4, 3, "Operario de ensamblaje", 1900000),
    (5, 4, "Ejecutiva comercial", 3600000),
    (6, 5, "Ingeniero de firmware", 6200000),
    (7, 6, "Administradora de sistemas", 5800000),
    (8, 2, "Analista de RR. HH.", 3400000),
]

# (id, cargo, documento, nombres, apellidos, email, telefono, fecha_ingreso, estado)
_EMPLEADOS = [
    (1, 1, "10000001", "Marta", "Quintero", "mquintero@novakey.example", "6010000001", "2026-01-15", "activo"),
    (2, 2, "10000002", "Jorge", "Salcedo", "jsalcedo@novakey.example", "6010000002", "2026-02-02", "activo"),
    (3, 3, "10000003", "Paula", "Rincón", "princon@novakey.example", "6010000003", "2026-02-02", "activo"),
    (4, 4, "10000004", "Wilson", "Duarte", "wduarte@novakey.example", "6010000004", "2026-03-02", "activo"),
    (5, 5, "10000005", "Elena", "Campos", "ecampos@novakey.example", "6010000005", "2026-03-16", "activo"),
    (6, 6, "10000006", "Tomás", "Arias", "tarias@novakey.example", "6010000006", "2026-02-16", "vacaciones"),
    (7, 7, "10000007", "Sara", "Linares", "slinares@novakey.example", "6010000007", "2026-02-02", "activo"),
    (8, 8, "10000008", "Nora", "Medina", "nmedina@novakey.example", "6010000008", "2026-03-02", "activo"),
]

# (empleado, hora_inicio, hora_fin) para lunes a viernes
_JORNADAS = [
    (1, "08:00", "17:00"), (2, "08:00", "17:00"), (3, "07:00", "16:00"), (4, "07:00", "16:00"),
    (5, "08:00", "17:00"), (6, "09:00", "18:00"), (7, "08:00", "17:00"), (8, "08:00", "17:00"),
]


def sembrar_si_vacio(sesion: Session) -> None:
    if sesion.scalar(select(func.count()).select_from(Empleado)) == 0:
        sembrar(sesion)


def sembrar(sesion: Session) -> None:
    """Reinicia cargos, empleados, horarios y nóminas a los datos de ejemplo."""
    sesion.execute(
        text(
            "TRUNCATE cargo, empleado, horario, nomina, detalle_nomina RESTART IDENTITY CASCADE"
        )
    )
    for cid, area, nombre, salario in _CARGOS:
        sesion.execute(
            text(
                "INSERT INTO cargo (id_cargo, id_area, nombre, salario_base) "
                "VALUES (:id, :a, :n, :s)"
            ),
            {"id": cid, "a": area, "n": nombre, "s": salario},
        )
    for eid, cargo, doc, nom, ape, email, tel, ingreso, estado in _EMPLEADOS:
        sesion.execute(
            text(
                "INSERT INTO empleado (id_empleado, id_cargo, documento, nombres, apellidos, "
                "email, telefono, fecha_ingreso, estado) "
                "VALUES (:id, :c, :d, :n, :ap, :e, :t, :f, :es)"
            ),
            {"id": eid, "c": cargo, "d": doc, "n": nom, "ap": ape, "e": email, "t": tel,
             "f": ingreso, "es": estado},
        )
    for emp, ini, fin in _JORNADAS:
        for dia in range(1, 6):
            sesion.execute(
                text(
                    "INSERT INTO horario (id_empleado, dia_semana, hora_inicio, hora_fin) "
                    "VALUES (:e, :d, :i, :f)"
                ),
                {"e": emp, "d": dia, "i": ini, "f": fin},
            )

    # Nómina de octubre 2026, ya pagada, con deducción del 8 % (empleado 4 con 180000 devengados).
    sesion.execute(
        text(
            "INSERT INTO nomina (id_nomina, periodo_inicio, periodo_fin, fecha_pago, estado) "
            "VALUES (1, '2026-10-01', '2026-10-31', '2026-10-30', 'pagada')"
        )
    )
    sesion.execute(
        text(
            """
            INSERT INTO detalle_nomina
                (id_nomina, id_empleado, salario_base, devengados, deducciones, neto_pagar)
            SELECT 1, e.id_empleado, c.salario_base,
                   CASE WHEN e.id_empleado = 4 THEN 180000 ELSE 0 END,
                   round(c.salario_base * 0.08, 2),
                   c.salario_base + CASE WHEN e.id_empleado = 4 THEN 180000 ELSE 0 END
                       - round(c.salario_base * 0.08, 2)
            FROM empleado e JOIN cargo c ON c.id_cargo = e.id_cargo
            """
        )
    )
    sesion.execute(text("SELECT setval(pg_get_serial_sequence('cargo','id_cargo'), 8)"))
    sesion.execute(text("SELECT setval(pg_get_serial_sequence('empleado','id_empleado'), 8)"))
    sesion.execute(text("SELECT setval(pg_get_serial_sequence('nomina','id_nomina'), 1)"))
    sesion.flush()

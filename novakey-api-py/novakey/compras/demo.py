"""Datos de demostración del módulo Compras (solo perfil ``demo``).

Siembra proveedores, órdenes de compra con sus detalles y cuentas por pagar, con los mismos
valores del proyecto original para que las pruebas verifiquen los mismos saldos.
Las órdenes referencian al usuario 4 (jsalcedo), por lo que debe sembrarse después de IAM.
"""

from __future__ import annotations

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from novakey.compras.modelo import Proveedor

# (id, nit, razon_social, contacto, email, telefono)
_PROVEEDORES = [
    (1, "900000001-1", "ElectroPartes S.A.S.", "Rocío Beltrán",
     "ventas@electropartes.example", "6010000101"),
    (2, "900000002-2", "Visual Tech Andina", "Hernán Prieto",
     "contacto@visualtech.example", "6010000102"),
    (3, "900000003-3", "Moldes y Carcasas Ltda.", "Gloria Nieto",
     "pedidos@moldes.example", "6010000103"),
    (4, "900000004-4", "Empaques del Centro", "Iván Rubio",
     "ventas@empaques.example", "6010000104"),
]

# (id, proveedor, usuario, fecha, estado, total)
_ORDENES = [
    (1, 1, 4, "2026-10-05", "recibida", 8360000),
    (2, 2, 4, "2026-10-20", "recibida", 13800000),
    (3, 3, 4, "2026-11-02", "enviada", 8700000),
]
# (orden, material, cantidad, recibida, precio)
_DETALLES = [
    (1, 1, 220, 220, 38000),
    (2, 6, 300, 300, 46000),
    (3, 5, 150, 0, 58000),
]
# (orden, monto, saldo, vencimiento, estado)
_CUENTAS = [
    (1, 8360000, 8360000, "2026-11-20", "abierta"),
    (2, 13800000, 13800000, "2026-12-05", "abierta"),
]


def sembrar_si_vacio(sesion: Session) -> None:
    if sesion.scalar(select(func.count()).select_from(Proveedor)) == 0:
        sembrar(sesion)


def sembrar(sesion: Session) -> None:
    """Reinicia proveedores, órdenes de compra y cuentas por pagar a los datos de ejemplo."""
    sesion.execute(
        text(
            "TRUNCATE proveedor, orden_compra, detalle_orden_compra, cuenta_por_pagar "
            "RESTART IDENTITY CASCADE"
        )
    )
    for pid, nit, razon, contacto, email, tel in _PROVEEDORES:
        sesion.execute(
            text(
                "INSERT INTO proveedor (id_proveedor, nit, razon_social, contacto, email, telefono)"
                " VALUES (:id, :nit, :r, :c, :e, :t)"
            ),
            {"id": pid, "nit": nit, "r": razon, "c": contacto, "e": email, "t": tel},
        )
    for oid, prov, usr, fecha, estado, total in _ORDENES:
        sesion.execute(
            text(
                "INSERT INTO orden_compra (id_orden_compra, id_proveedor, id_usuario, fecha, "
                "estado, total) VALUES (:id, :p, :u, :f, :e, :t)"
            ),
            {"id": oid, "p": prov, "u": usr, "f": fecha, "e": estado, "t": total},
        )
    for orden, material, cant, recibida, precio in _DETALLES:
        sesion.execute(
            text(
                "INSERT INTO detalle_orden_compra (id_orden_compra, id_material, cantidad, "
                "cantidad_recibida, precio_unitario) VALUES (:o, :m, :c, :r, :p)"
            ),
            {"o": orden, "m": material, "c": cant, "r": recibida, "p": precio},
        )
    for orden, monto, saldo, venc, estado in _CUENTAS:
        sesion.execute(
            text(
                "INSERT INTO cuenta_por_pagar (id_orden_compra, monto, saldo, fecha_vencimiento, "
                "estado) VALUES (:o, :m, :s, :v, :e)"
            ),
            {"o": orden, "m": monto, "s": saldo, "v": venc, "e": estado},
        )
    sesion.execute(text("SELECT setval(pg_get_serial_sequence('proveedor','id_proveedor'), 4)"))
    sesion.execute(
        text("SELECT setval(pg_get_serial_sequence('orden_compra','id_orden_compra'), 3)")
    )
    sesion.flush()

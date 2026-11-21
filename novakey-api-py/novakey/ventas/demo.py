"""Datos de demostración del módulo Ventas (solo perfil ``demo``).

Siembra clientes, cotizaciones, pedidos y la factura de ejemplo, con los mismos valores del
proyecto original para que las pruebas verifiquen los mismos cálculos (IVA, disponibilidad, etc.).
Depende de que ya existan usuarios (RF01) y productos (RF02).
"""

from __future__ import annotations

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from novakey.ventas.modelo import Cliente

_CLIENTES = [
    (1, "corp", "901000001-1", "Andina Software S.A.S.", "compras@andinasoftware.example",
     "6010000201", "Bogotá"),
    (2, "corp", "901000002-2", "TecnoRed Distribuciones", "compras@tecnored.example",
     "6010000202", "Bogotá"),
    (3, "final", "20000003", "Lucía Fernández", "lucia@correo.example", "3000000203", "Bogotá"),
    (4, "corp", "901000004-4", "Estudio Kinetic", "hola@kinetic.example", "6010000204", "Bogotá"),
]

# (id, cliente, usuario, fecha, vigencia, estado, total)
_COTIZACIONES = [
    (1, 1, 2, "2026-10-29", "2026-11-15", "aceptada", 6900000),
    (2, 4, 2, "2026-11-03", "2026-11-30", "enviada", 3450000),
]
# (cotizacion, producto, cantidad, precio)
_DETALLES_COT = [
    (1, 1, 10, 690000),
    (2, 1, 5, 690000),
]
# (id, cliente, cotizacion, canal, fecha, estado)
_PEDIDOS = [
    (1, 3, None, "directo", "2026-10-22 10:00:00", "facturado"),
    (2, 2, None, "directo", "2026-11-01 09:15:00", "confirmado"),
    (3, 1, 1, "directo", "2026-11-03 14:30:00", "en_preparacion"),
]
# (pedido, producto, cantidad, precio)
_DETALLES_PED = [
    (1, 1, 1, 690000),
    (2, 2, 2, 590000),
    (3, 1, 10, 690000),
]
# (pedido, numero, fecha, subtotal, impuestos, total, estado)
_FACTURAS = [
    (1, "FAC-0001", "2026-10-22", 690000, 131100, 821100, "pagada"),
]
# Movimiento de salida por el pedido 3 (ya descontado del stock en los datos de inventario).
_MOVIMIENTO_PED3 = (1, 2, "salida_venta", 10, "PED-0003", "2026-11-03 14:30:00")


def sembrar_si_vacio(sesion: Session) -> None:
    if sesion.scalar(select(func.count()).select_from(Cliente)) == 0:
        sembrar(sesion)


def sembrar(sesion: Session) -> None:
    """Reinicia clientes, cotizaciones, pedidos y facturas a los datos de ejemplo."""
    sesion.execute(
        text(
            "TRUNCATE cliente, cotizacion, detalle_cotizacion, pedido, detalle_pedido, factura "
            "RESTART IDENTITY CASCADE"
        )
    )
    for cid, tipo, doc, nombre, email, tel, dir_ in _CLIENTES:
        sesion.execute(
            text(
                "INSERT INTO cliente (id_cliente, tipo, documento, nombre, email, telefono, "
                "direccion) VALUES (:id, :t, :d, :n, :e, :tel, :dir)"
            ),
            {"id": cid, "t": tipo, "d": doc, "n": nombre, "e": email, "tel": tel, "dir": dir_},
        )
    for cid, cli, usr, fecha, vig, estado, total in _COTIZACIONES:
        sesion.execute(
            text(
                "INSERT INTO cotizacion (id_cotizacion, id_cliente, id_usuario, fecha, vigencia, "
                "estado, total) VALUES (:id, :cl, :u, :f, :v, :e, :t)"
            ),
            {"id": cid, "cl": cli, "u": usr, "f": fecha, "v": vig, "e": estado, "t": total},
        )
    for cot, prod, cant, precio in _DETALLES_COT:
        sesion.execute(
            text(
                "INSERT INTO detalle_cotizacion (id_cotizacion, id_producto, cantidad, "
                "precio_unitario) VALUES (:c, :p, :cant, :pr)"
            ),
            {"c": cot, "p": prod, "cant": cant, "pr": precio},
        )
    for pid, cli, cot, canal, fecha, estado in _PEDIDOS:
        sesion.execute(
            text(
                "INSERT INTO pedido (id_pedido, id_cliente, id_cotizacion, canal, fecha, estado) "
                "VALUES (:id, :cl, :cot, :ca, :f, :e)"
            ),
            {"id": pid, "cl": cli, "cot": cot, "ca": canal, "f": fecha, "e": estado},
        )
    for ped, prod, cant, precio in _DETALLES_PED:
        sesion.execute(
            text(
                "INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) "
                "VALUES (:p, :pr, :c, :pu)"
            ),
            {"p": ped, "pr": prod, "c": cant, "pu": precio},
        )
    for ped, numero, fecha, sub, imp, total, estado in _FACTURAS:
        sesion.execute(
            text(
                "INSERT INTO factura (id_pedido, numero, fecha, subtotal, impuestos, total, estado)"
                " VALUES (:p, :n, :f, :s, :i, :t, :e)"
            ),
            {"p": ped, "n": numero, "f": fecha, "s": sub, "i": imp, "t": total, "e": estado},
        )
    # Movimiento de la salida por el pedido 3, con el usuario comercial (id 2).
    mov_pid, mov_usr, tipo, cant, ref, fecha = _MOVIMIENTO_PED3
    sesion.execute(
        text(
            "INSERT INTO movimiento_inventario (id_producto, id_usuario, tipo, cantidad, "
            "documento_ref, fecha) VALUES (:p, :u, :t, :c, :r, :f)"
        ),
        {"p": mov_pid, "u": mov_usr, "t": tipo, "c": cant, "r": ref, "f": fecha},
    )
    sesion.execute(text("SELECT setval(pg_get_serial_sequence('cliente','id_cliente'), 4)"))
    sesion.execute(
        text("SELECT setval(pg_get_serial_sequence('cotizacion','id_cotizacion'), 2)")
    )
    sesion.execute(text("SELECT setval(pg_get_serial_sequence('pedido','id_pedido'), 3)"))
    sesion.execute(text("SELECT setval('numero_factura_seq', 1)"))
    sesion.flush()

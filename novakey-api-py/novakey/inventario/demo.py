"""Datos de demostración del módulo Inventario y Producción (solo perfil ``demo``).

Siembra materiales, productos y listas de materiales, además de las órdenes de producción,
consumos y unidades de ejemplo. Los valores coinciden con el conjunto de datos del proyecto
original para que las pruebas de integración verifiquen los mismos saldos.
"""

from __future__ import annotations

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from novakey.inventario.modelo import Material

_MATERIALES = [
    (1, "MAT-001", "PCB principal", "und", 420, 150, 38000),
    (2, "MAT-002", "Kit de componentes electrónicos", "kit", 380, 150, 24000),
    (3, "MAT-003", "Interruptor mecánico", "und", 6200, 3000, 1100),
    (4, "MAT-004", "Juego de teclas", "jgo", 310, 120, 42000),
    (5, "MAT-005", "Carcasa modular", "und", 96, 120, 58000),
    (6, "MAT-006", "Pantalla OLED", "und", 64, 100, 46000),
    (7, "MAT-007", "Cable USB-C", "und", 500, 150, 9500),
    (8, "MAT-008", "Kit de fijaciones", "kit", 640, 150, 3200),
    (9, "MAT-009", "Caja de empaque", "und", 140, 150, 6800),
]

_PRODUCTOS = [
    (1, "NK-TEC-75", "Teclado NovaKey 75 % OLED", 690000, 48),
    (2, "NK-TEC-60", "Teclado NovaKey 60 % OLED", 590000, 12),
    (3, "NK-MOD-OLED", "Módulo OLED adicional", 180000, 30),
]

# (producto, material, cantidad)
_LISTAS = [
    (1, 1, 1), (1, 2, 1), (1, 3, 84), (1, 4, 1), (1, 5, 1),
    (1, 6, 1), (1, 7, 1), (1, 8, 1), (1, 9, 1),
    (2, 1, 1), (2, 2, 1), (2, 3, 61), (2, 4, 1), (2, 5, 1),
    (2, 6, 1), (2, 7, 1), (2, 8, 1), (2, 9, 1),
    (3, 6, 1), (3, 8, 1), (3, 9, 1),
]


def sembrar_si_vacio(sesion: Session) -> None:
    if sesion.scalar(select(func.count()).select_from(Material)) == 0:
        sembrar(sesion)


def sembrar(sesion: Session) -> None:
    """Reinicia materiales, productos y listas a los datos de ejemplo."""
    sesion.execute(text("DELETE FROM lista_materiales"))
    sesion.execute(text("DELETE FROM material"))
    sesion.execute(text("DELETE FROM producto"))

    for mid, codigo, nombre, um, sa_, sm, costo in _MATERIALES:
        sesion.execute(
            text(
                "INSERT INTO material (id_material, codigo, nombre, unidad_medida, "
                "stock_actual, stock_minimo, costo_unitario) "
                "VALUES (:id, :c, :n, :um, :sa, :sm, :co)"
            ),
            {"id": mid, "c": codigo, "n": nombre, "um": um, "sa": sa_, "sm": sm, "co": costo},
        )
    for pid, sku, nombre, precio, stock in _PRODUCTOS:
        sesion.execute(
            text(
                "INSERT INTO producto (id_producto, sku, nombre, precio_venta, stock_actual) "
                "VALUES (:id, :s, :n, :p, :st)"
            ),
            {"id": pid, "s": sku, "n": nombre, "p": precio, "st": stock},
        )
    for pid, mid, cant in _LISTAS:
        sesion.execute(
            text(
                "INSERT INTO lista_materiales (id_producto, id_material, cantidad) "
                "VALUES (:p, :m, :c)"
            ),
            {"p": pid, "m": mid, "c": cant},
        )

    sesion.execute(
        text("SELECT setval(pg_get_serial_sequence('material','id_material'), 9)")
    )
    sesion.execute(
        text("SELECT setval(pg_get_serial_sequence('producto','id_producto'), 3)")
    )
    sesion.flush()

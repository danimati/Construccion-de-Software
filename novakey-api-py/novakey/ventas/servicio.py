"""Lógica de negocio de pedidos reutilizable dentro del monolito.

Vive aparte del router para que otros módulos (p. ej. la integración con la tienda, RF06) abran
pedidos con la misma verificación de disponibilidad, sin duplicar reglas ni crear ciclos de import.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from novakey.inventario import existencias as stock
from novakey.inventario.modelo import TipoMovimiento
from novakey.ventas.modelo import CanalPedido, DetallePedido, Pedido


class LineaPedido:
    """Línea simple de un pedido: producto, cantidad y precio unitario."""

    def __init__(self, producto_id: int, cantidad: int, precio_unitario) -> None:
        self.producto_id = producto_id
        self.cantidad = cantidad
        self.precio_unitario = precio_unitario


def _doc(id: int) -> str:
    return f"PED-{id:04d}"


def abrir_pedido(
    sesion: Session,
    usuario_id: int,
    cliente_id: int,
    cotizacion_id: int | None,
    lineas: list[LineaPedido],
    canal: CanalPedido = CanalPedido.directo,
) -> Pedido:
    """Crea un pedido y descuenta existencias. Si falta stock, la transacción se deshace entera.

    Las líneas se procesan por id de producto ascendente para bloquear siempre en el mismo orden
    y evitar interbloqueos con producción y compras. ``TipoMovimiento`` se importa para dejar claro
    que el descuento queda registrado como ``salida_venta`` dentro de ``Existencias``.
    """
    _ = TipoMovimiento  # el movimiento lo registra Existencias.salida_venta
    p = Pedido(
        cliente_id=cliente_id,
        cotizacion_id=cotizacion_id,
        canal=canal.value,
        fecha=datetime.now().replace(microsecond=0),
    )
    for line in lineas:
        p.detalles.append(
            DetallePedido(
                producto_id=line.producto_id,
                cantidad=line.cantidad,
                precio_unitario=line.precio_unitario,
            )
        )
    sesion.add(p)
    sesion.flush()
    for line in sorted(lineas, key=lambda x: x.producto_id):
        stock.salida_venta(sesion, usuario_id, line.producto_id, line.cantidad, _doc(p.id))
    return p

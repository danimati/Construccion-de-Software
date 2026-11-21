"""Interfaz pública que Inventario ofrece a Compras y Ventas.

Opera sobre la sesión (transacción) de quien llama, de modo que un fallo deshace también el
documento. Quien llama debe recorrer sus líneas ordenadas por id de producto/material: así todas
las transacciones bloquean en el mismo orden y no se producen interbloqueos.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from novakey.errores import NoEncontrado, ReglaNegocio
from novakey.inventario.modelo import (
    Material,
    MovimientoInventario,
    Producto,
    TipoMovimiento,
)


def _ahora() -> datetime:
    return datetime.now().replace(microsecond=0)


def _bloquear_material(sesion: Session, material_id: int) -> Material:
    m = sesion.scalar(select(Material).where(Material.id == material_id).with_for_update())
    if m is None:
        raise NoEncontrado("Material no encontrado.")
    return m


def _bloquear_producto(sesion: Session, producto_id: int) -> Producto:
    p = sesion.scalar(select(Producto).where(Producto.id == producto_id).with_for_update())
    if p is None:
        raise NoEncontrado("Producto no encontrado.")
    return p


def registrar(
    sesion: Session,
    usuario_id: int,
    tipo: TipoMovimiento,
    cantidad: Decimal,
    documento: str,
    *,
    material_id: int | None = None,
    producto_id: int | None = None,
) -> None:
    sesion.add(
        MovimientoInventario(
            material_id=material_id,
            producto_id=producto_id,
            usuario_id=usuario_id,
            tipo=tipo.value,
            cantidad=cantidad,
            documento_ref=documento,
            fecha=_ahora(),
        )
    )


def entrada_compra(
    sesion: Session, usuario_id: int, material_id: int, cantidad: Decimal, documento: str
) -> None:
    """Compras: lo recibido se suma al material."""
    m = _bloquear_material(sesion, material_id)
    m.stock_actual = m.stock_actual + cantidad
    registrar(
        sesion,
        usuario_id,
        TipoMovimiento.entrada_compra,
        cantidad,
        documento,
        material_id=material_id,
    )


def salida_venta(
    sesion: Session, usuario_id: int, producto_id: int, cantidad: int, documento: str
) -> None:
    """Ventas: descuenta el producto o rechaza la operación si no hay disponibilidad."""
    p = _bloquear_producto(sesion, producto_id)
    if p.stock_actual < cantidad:
        raise ReglaNegocio(
            f"{p.nombre}: disponibles {p.stock_actual}, solicitadas {cantidad}."
        )
    p.stock_actual = p.stock_actual - cantidad
    registrar(
        sesion,
        usuario_id,
        TipoMovimiento.salida_venta,
        Decimal(cantidad),
        documento,
        producto_id=producto_id,
    )


def devolucion_venta(
    sesion: Session, usuario_id: int, producto_id: int, cantidad: int, documento: str
) -> None:
    p = _bloquear_producto(sesion, producto_id)
    p.stock_actual = p.stock_actual + cantidad
    registrar(
        sesion,
        usuario_id,
        TipoMovimiento.devolucion_venta,
        Decimal(cantidad),
        documento,
        producto_id=producto_id,
    )

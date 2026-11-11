"""API REST del módulo Ventas (RF04)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from novakey.db import get_session
from novakey.errores import NoEncontrado, ReglaNegocio
from novakey.iam.modelo import Usuario
from novakey.iam.seguridad import exige
from novakey.inventario import existencias as stock
from novakey.ventas import esquemas as e
from novakey.ventas.modelo import (
    Cliente,
    Cotizacion,
    DetalleCotizacion,
    DetallePedido,
    EstadoCotizacion,
    EstadoFactura,
    EstadoPedido,
    Factura,
    Pedido,
)

router = APIRouter(tags=["ventas"])

Sesion = Annotated[Session, Depends(get_session)]

TASA_IVA = Decimal("0.19")


def _doc(id: int) -> str:
    return f"PED-{id:04d}"


def _ahora() -> datetime:
    return datetime.now().replace(microsecond=0)


# ---------------- Clientes ----------------


@router.get("/clientes", response_model=list[e.ClienteOut])
def clientes(sesion: Sesion, _: Annotated[Usuario, Depends(exige("ventas:ver"))]):
    filas = sesion.scalars(select(Cliente).order_by(Cliente.id)).all()
    return [e.ClienteOut.de(c) for c in filas]


@router.post("/clientes", response_model=e.ClienteOut, status_code=status.HTTP_201_CREATED)
def crear_cliente(
    n: e.NuevoCliente, sesion: Sesion, _: Annotated[Usuario, Depends(exige("ventas:editar"))]
):
    documento = n.documento.strip()
    if sesion.scalar(select(Cliente).where(Cliente.documento == documento)):
        raise ReglaNegocio("Ya existe un cliente con ese documento.")
    c = Cliente(
        tipo=n.tipo,
        documento=documento,
        nombre=n.nombre.strip(),
        email=n.email,
        telefono=n.telefono,
        direccion=n.direccion,
    )
    sesion.add(c)
    sesion.flush()
    return e.ClienteOut.de(c)


# ---------------- Cotizaciones ----------------


@router.get("/cotizaciones", response_model=list[e.CotizacionOut])
def cotizaciones(sesion: Sesion, _: Annotated[Usuario, Depends(exige("ventas:ver"))]):
    filas = sesion.scalars(select(Cotizacion).order_by(Cotizacion.id.desc())).all()
    return [e.CotizacionOut.de(c) for c in filas]


@router.post("/cotizaciones", response_model=e.CotizacionOut, status_code=status.HTTP_201_CREATED)
def crear_cotizacion(
    n: e.NuevaCotizacion,
    sesion: Sesion,
    usuario: Annotated[Usuario, Depends(exige("ventas:editar"))],
):
    if sesion.get(Cliente, n.cliente_id) is None:
        raise NoEncontrado("El cliente no existe.")
    c = Cotizacion(
        cliente_id=n.cliente_id,
        usuario_id=usuario.id,
        fecha=date.today(),
        vigencia=n.vigencia,
        total=Decimal(0),
    )
    total = Decimal(0)
    for line in n.lineas:
        c.detalles.append(
            DetalleCotizacion(
                producto_id=line.producto_id,
                cantidad=line.cantidad,
                precio_unitario=line.precio_unitario,
            )
        )
        total += line.precio_unitario * line.cantidad
    c.total = total
    sesion.add(c)
    sesion.flush()
    return e.CotizacionOut.de(c)


def _bloquear_cotizacion(sesion: Session, id: int) -> Cotizacion:
    c = sesion.scalar(select(Cotizacion).where(Cotizacion.id == id).with_for_update())
    if c is None:
        raise NoEncontrado("La cotización no existe.")
    return c


@router.post("/cotizaciones/{id}/rechazar", response_model=e.CotizacionOut)
def rechazar(id: int, sesion: Sesion, _: Annotated[Usuario, Depends(exige("ventas:editar"))]):
    c = _bloquear_cotizacion(sesion, id)
    if c.estado != EstadoCotizacion.enviada.value:
        raise ReglaNegocio("La cotización ya no está abierta.")
    c.estado = EstadoCotizacion.rechazada.value
    return e.CotizacionOut.de(c)


@router.post(
    "/cotizaciones/{id}/pedido", response_model=e.PedidoOut, status_code=status.HTTP_201_CREATED
)
def convertir(
    id: int, sesion: Sesion, usuario: Annotated[Usuario, Depends(exige("ventas:editar"))]
):
    c = _bloquear_cotizacion(sesion, id)
    if c.estado != EstadoCotizacion.enviada.value:
        raise ReglaNegocio("La cotización ya no está abierta.")
    c.estado = EstadoCotizacion.aceptada.value
    lineas = [
        e.NuevaLinea(
            producto_id=d.producto_id, cantidad=d.cantidad, precio_unitario=d.precio_unitario
        )
        for d in c.detalles
    ]
    pedido = _abrir_pedido(sesion, usuario.id, c.cliente_id, c.id, lineas)
    return e.PedidoOut.de(pedido)


# ---------------- Pedidos ----------------


@router.get("/pedidos", response_model=list[e.PedidoOut])
def pedidos(sesion: Sesion, _: Annotated[Usuario, Depends(exige("ventas:ver"))]):
    filas = sesion.scalars(select(Pedido).order_by(Pedido.id.desc())).all()
    return [e.PedidoOut.de(p) for p in filas]


@router.post("/pedidos", response_model=e.PedidoOut, status_code=status.HTTP_201_CREATED)
def crear_pedido(
    n: e.NuevoPedido, sesion: Sesion, usuario: Annotated[Usuario, Depends(exige("ventas:editar"))]
):
    if sesion.get(Cliente, n.cliente_id) is None:
        raise NoEncontrado("El cliente no existe.")
    pedido = _abrir_pedido(sesion, usuario.id, n.cliente_id, None, n.lineas)
    return e.PedidoOut.de(pedido)


def _abrir_pedido(
    sesion: Session,
    usuario_id: int,
    cliente_id: int,
    cotizacion_id: int | None,
    lineas: list[e.NuevaLinea],
) -> Pedido:
    p = Pedido(
        cliente_id=cliente_id,
        cotizacion_id=cotizacion_id,
        fecha=_ahora(),
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
    # Se descuenta por id de producto ascendente para bloquear siempre en el mismo orden.
    for line in sorted(lineas, key=lambda x: x.producto_id):
        stock.salida_venta(sesion, usuario_id, line.producto_id, line.cantidad, _doc(p.id))
    return p


def _bloquear_pedido(sesion: Session, id: int) -> Pedido:
    p = sesion.scalar(select(Pedido).where(Pedido.id == id).with_for_update())
    if p is None:
        raise NoEncontrado("El pedido no existe.")
    return p


@router.post("/pedidos/{id}/preparar", response_model=e.PedidoOut)
def preparar(id: int, sesion: Sesion, _: Annotated[Usuario, Depends(exige("ventas:editar"))]):
    p = _bloquear_pedido(sesion, id)
    if p.estado != EstadoPedido.confirmado.value:
        raise ReglaNegocio("El pedido no está confirmado.")
    p.estado = EstadoPedido.en_preparacion.value
    return e.PedidoOut.de(p)


@router.post("/pedidos/{id}/cancelar", response_model=e.PedidoOut)
def cancelar(id: int, sesion: Sesion, usuario: Annotated[Usuario, Depends(exige("ventas:editar"))]):
    p = _bloquear_pedido(sesion, id)
    if not p.abierto():
        raise ReglaNegocio("Solo se cancelan pedidos sin facturar.")
    p.estado = EstadoPedido.cancelado.value
    for d in sorted(p.detalles, key=lambda x: x.producto_id):
        stock.devolucion_venta(sesion, usuario.id, d.producto_id, d.cantidad, _doc(id))
    return e.PedidoOut.de(p)


@router.post(
    "/pedidos/{id}/factura", response_model=e.FacturaOut, status_code=status.HTTP_201_CREATED
)
def facturar(id: int, sesion: Sesion, _: Annotated[Usuario, Depends(exige("ventas:editar"))]):
    p = _bloquear_pedido(sesion, id)
    if not p.abierto():
        raise ReglaNegocio("El pedido no se puede facturar.")
    subtotal = sum(
        (d.precio_unitario * d.cantidad for d in p.detalles), start=Decimal(0)
    )
    impuestos = (subtotal * TASA_IVA).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    numero = sesion.scalar(text("select nextval('numero_factura_seq')"))
    f = Factura(
        pedido_id=id,
        numero=f"FAC-{numero:04d}",
        fecha=date.today(),
        subtotal=subtotal,
        impuestos=impuestos,
        total=subtotal + impuestos,
    )
    p.estado = EstadoPedido.facturado.value
    sesion.add(f)
    sesion.flush()
    return e.FacturaOut.de(f)


# ---------------- Facturas ----------------


@router.get("/facturas", response_model=list[e.FacturaOut])
def facturas(sesion: Sesion, _: Annotated[Usuario, Depends(exige("ventas:ver"))]):
    filas = sesion.scalars(select(Factura).order_by(Factura.id.desc())).all()
    return [e.FacturaOut.de(f) for f in filas]


@router.post("/facturas/{id}/pagada", response_model=e.FacturaOut)
def marcar_pagada(id: int, sesion: Sesion, _: Annotated[Usuario, Depends(exige("ventas:editar"))]):
    f = sesion.get(Factura, id)
    if f is None:
        raise NoEncontrado("La factura no existe.")
    f.estado = EstadoFactura.pagada.value
    return e.FacturaOut.de(f)

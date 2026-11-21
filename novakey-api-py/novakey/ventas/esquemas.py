"""Esquemas Pydantic del módulo Ventas."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from novakey.ventas.modelo import Cliente, Cotizacion, Factura, Pedido


class ClienteOut(BaseModel):
    id: int
    tipo: str
    documento: str
    nombre: str
    email: str | None
    telefono: str | None
    direccion: str | None

    @classmethod
    def de(cls, c: Cliente) -> ClienteOut:
        return cls.model_validate(c, from_attributes=True)


class LineaOut(BaseModel):
    id: int
    producto_id: int
    cantidad: int
    precio_unitario: Decimal


class CotizacionOut(BaseModel):
    id: int
    cliente_id: int
    usuario_id: int
    fecha: date
    vigencia: date
    estado: str
    total: Decimal
    detalles: list[LineaOut]

    @classmethod
    def de(cls, c: Cotizacion) -> CotizacionOut:
        return cls(
            id=c.id,
            cliente_id=c.cliente_id,
            usuario_id=c.usuario_id,
            fecha=c.fecha,
            vigencia=c.vigencia,
            estado=c.estado,
            total=c.total,
            detalles=[
                LineaOut(
                    id=d.id,
                    producto_id=d.producto_id,
                    cantidad=d.cantidad,
                    precio_unitario=d.precio_unitario,
                )
                for d in c.detalles
            ],
        )


class PedidoOut(BaseModel):
    id: int
    cliente_id: int
    cotizacion_id: int | None
    canal: str
    fecha: datetime
    estado: str
    detalles: list[LineaOut]

    @classmethod
    def de(cls, p: Pedido) -> PedidoOut:
        return cls(
            id=p.id,
            cliente_id=p.cliente_id,
            cotizacion_id=p.cotizacion_id,
            canal=p.canal,
            fecha=p.fecha,
            estado=p.estado,
            detalles=[
                LineaOut(
                    id=d.id,
                    producto_id=d.producto_id,
                    cantidad=d.cantidad,
                    precio_unitario=d.precio_unitario,
                )
                for d in p.detalles
            ],
        )


class FacturaOut(BaseModel):
    id: int
    pedido_id: int
    numero: str
    fecha: date
    subtotal: Decimal
    impuestos: Decimal
    total: Decimal
    estado: str

    @classmethod
    def de(cls, f: Factura) -> FacturaOut:
        return cls.model_validate(f, from_attributes=True)


class NuevoCliente(BaseModel):
    tipo: Literal["corp", "final"]
    documento: str = Field(min_length=1)
    nombre: str = Field(min_length=1)
    email: str | None = None
    telefono: str | None = None
    direccion: str | None = None


class NuevaLinea(BaseModel):
    producto_id: int
    cantidad: int = Field(gt=0)
    precio_unitario: Decimal = Field(gt=0)


class NuevaCotizacion(BaseModel):
    cliente_id: int
    lineas: list[NuevaLinea] = Field(min_length=1)
    vigencia: date


class NuevoPedido(BaseModel):
    cliente_id: int
    lineas: list[NuevaLinea] = Field(min_length=1)

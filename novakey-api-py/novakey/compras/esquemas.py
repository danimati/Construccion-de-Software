"""Esquemas Pydantic del módulo Compras."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from novakey.compras.modelo import CuentaPorPagar, OrdenCompra, Proveedor


class ProveedorOut(BaseModel):
    id: int
    nit: str
    razon_social: str
    contacto: str | None
    email: str | None
    telefono: str | None

    @classmethod
    def de(cls, p: Proveedor) -> ProveedorOut:
        return cls.model_validate(p, from_attributes=True)


class DetalleOut(BaseModel):
    id: int
    material_id: int
    cantidad: Decimal
    cantidad_recibida: Decimal
    precio_unitario: Decimal


class OrdenCompraOut(BaseModel):
    id: int
    proveedor_id: int
    usuario_id: int
    fecha: date
    estado: str
    total: Decimal
    detalles: list[DetalleOut]

    @classmethod
    def de(cls, o: OrdenCompra) -> OrdenCompraOut:
        return cls(
            id=o.id,
            proveedor_id=o.proveedor_id,
            usuario_id=o.usuario_id,
            fecha=o.fecha,
            estado=o.estado,
            total=o.total,
            detalles=[
                DetalleOut(
                    id=d.id,
                    material_id=d.material_id,
                    cantidad=d.cantidad,
                    cantidad_recibida=d.cantidad_recibida,
                    precio_unitario=d.precio_unitario,
                )
                for d in o.detalles
            ],
        )


class CuentaOut(BaseModel):
    id: int
    orden_compra_id: int
    monto: Decimal
    saldo: Decimal
    fecha_vencimiento: date
    estado: str

    @classmethod
    def de(cls, c: CuentaPorPagar) -> CuentaOut:
        return cls.model_validate(c, from_attributes=True)


class NuevoProveedor(BaseModel):
    nit: str = Field(min_length=1)
    razon_social: str = Field(min_length=1)
    contacto: str | None = None
    email: str | None = None
    telefono: str | None = None


class NuevaLinea(BaseModel):
    material_id: int
    cantidad: Decimal = Field(gt=0)
    precio_unitario: Decimal = Field(gt=0)


class NuevaOrden(BaseModel):
    proveedor_id: int
    lineas: list[NuevaLinea] = Field(min_length=1)


class Recepcion(BaseModel):
    # Mapa id_detalle -> cantidad recibida. Las claves JSON llegan como texto.
    cantidades: dict[int, Decimal] = Field(min_length=1)


class Pago(BaseModel):
    monto: Decimal = Field(gt=0)

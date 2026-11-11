"""Modelos del módulo Compras. Conservan el esquema del proyecto original."""

from __future__ import annotations

import enum
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from novakey.db import Base


class EstadoOrdenCompra(enum.StrEnum):
    enviada = "enviada"
    parcial = "parcial"
    recibida = "recibida"
    cancelada = "cancelada"


class EstadoCuenta(enum.StrEnum):
    abierta = "abierta"
    pagada = "pagada"


class Proveedor(Base):
    __tablename__ = "proveedor"

    id: Mapped[int] = mapped_column("id_proveedor", primary_key=True)
    nit: Mapped[str] = mapped_column(String(20), unique=True)
    razon_social: Mapped[str] = mapped_column(String(120))
    contacto: Mapped[str | None] = mapped_column(String(80))
    email: Mapped[str | None] = mapped_column(String(120))
    telefono: Mapped[str | None] = mapped_column(String(20))


class DetalleOrdenCompra(Base):
    __tablename__ = "detalle_orden_compra"

    id: Mapped[int] = mapped_column("id_detalle_oc", primary_key=True)
    orden_compra_id: Mapped[int] = mapped_column(
        "id_orden_compra", ForeignKey("orden_compra.id_orden_compra")
    )
    material_id: Mapped[int] = mapped_column("id_material", ForeignKey("material.id_material"))
    cantidad: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    cantidad_recibida: Mapped[Decimal] = mapped_column(
        "cantidad_recibida", Numeric(12, 3), default=Decimal(0), server_default="0"
    )
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    def pendiente(self) -> Decimal:
        return self.cantidad - self.cantidad_recibida


class OrdenCompra(Base):
    __tablename__ = "orden_compra"

    id: Mapped[int] = mapped_column("id_orden_compra", primary_key=True)
    proveedor_id: Mapped[int] = mapped_column("id_proveedor", ForeignKey("proveedor.id_proveedor"))
    usuario_id: Mapped[int] = mapped_column("id_usuario", ForeignKey("usuario.id_usuario"))
    fecha: Mapped[date] = mapped_column(Date)
    estado: Mapped[str] = mapped_column(String(20), default=EstadoOrdenCompra.enviada.value)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2))

    detalles: Mapped[list[DetalleOrdenCompra]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by=DetalleOrdenCompra.material_id
    )


class CuentaPorPagar(Base):
    __tablename__ = "cuenta_por_pagar"

    id: Mapped[int] = mapped_column("id_cxp", primary_key=True)
    orden_compra_id: Mapped[int] = mapped_column(
        "id_orden_compra", ForeignKey("orden_compra.id_orden_compra"), unique=True
    )
    monto: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    saldo: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    fecha_vencimiento: Mapped[date] = mapped_column("fecha_vencimiento", Date)
    estado: Mapped[str] = mapped_column(String(20), default=EstadoCuenta.abierta.value)

"""Modelos del módulo Ventas. Conservan el esquema del proyecto original."""

from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from novakey.db import Base


class EstadoCotizacion(enum.StrEnum):
    enviada = "enviada"
    aceptada = "aceptada"
    rechazada = "rechazada"


class EstadoPedido(enum.StrEnum):
    confirmado = "confirmado"
    en_preparacion = "en_preparacion"
    facturado = "facturado"
    cancelado = "cancelado"


class CanalPedido(enum.StrEnum):
    directo = "directo"
    web = "web"


class EstadoFactura(enum.StrEnum):
    emitida = "emitida"
    pagada = "pagada"


class Cliente(Base):
    __tablename__ = "cliente"

    id: Mapped[int] = mapped_column("id_cliente", primary_key=True)
    tipo: Mapped[str] = mapped_column(String(10))
    documento: Mapped[str] = mapped_column(String(20), unique=True)
    nombre: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(120))
    telefono: Mapped[str | None] = mapped_column(String(20))
    direccion: Mapped[str | None] = mapped_column(String(150))


class DetalleCotizacion(Base):
    __tablename__ = "detalle_cotizacion"

    id: Mapped[int] = mapped_column("id_detalle_cot", primary_key=True)
    cotizacion_id: Mapped[int] = mapped_column(
        "id_cotizacion", ForeignKey("cotizacion.id_cotizacion")
    )
    producto_id: Mapped[int] = mapped_column("id_producto", ForeignKey("producto.id_producto"))
    cantidad: Mapped[int] = mapped_column(Integer)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2))


class Cotizacion(Base):
    __tablename__ = "cotizacion"

    id: Mapped[int] = mapped_column("id_cotizacion", primary_key=True)
    cliente_id: Mapped[int] = mapped_column("id_cliente", ForeignKey("cliente.id_cliente"))
    usuario_id: Mapped[int] = mapped_column("id_usuario", ForeignKey("usuario.id_usuario"))
    fecha: Mapped[date] = mapped_column(Date)
    vigencia: Mapped[date] = mapped_column(Date)
    estado: Mapped[str] = mapped_column(String(20), default=EstadoCotizacion.enviada.value)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2))

    detalles: Mapped[list[DetalleCotizacion]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class DetallePedido(Base):
    __tablename__ = "detalle_pedido"

    id: Mapped[int] = mapped_column("id_detalle_pedido", primary_key=True)
    pedido_id: Mapped[int] = mapped_column("id_pedido", ForeignKey("pedido.id_pedido"))
    producto_id: Mapped[int] = mapped_column("id_producto", ForeignKey("producto.id_producto"))
    cantidad: Mapped[int] = mapped_column(Integer)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2))


class Pedido(Base):
    __tablename__ = "pedido"

    id: Mapped[int] = mapped_column("id_pedido", primary_key=True)
    cliente_id: Mapped[int] = mapped_column("id_cliente", ForeignKey("cliente.id_cliente"))
    cotizacion_id: Mapped[int | None] = mapped_column(
        "id_cotizacion", ForeignKey("cotizacion.id_cotizacion")
    )
    canal: Mapped[str] = mapped_column(String(10), default=CanalPedido.directo.value)
    fecha: Mapped[datetime] = mapped_column(DateTime)
    estado: Mapped[str] = mapped_column(String(20), default=EstadoPedido.confirmado.value)

    detalles: Mapped[list[DetallePedido]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )

    def abierto(self) -> bool:
        return self.estado in (EstadoPedido.confirmado.value, EstadoPedido.en_preparacion.value)


class Factura(Base):
    __tablename__ = "factura"

    id: Mapped[int] = mapped_column("id_factura", primary_key=True)
    pedido_id: Mapped[int] = mapped_column("id_pedido", ForeignKey("pedido.id_pedido"), unique=True)
    numero: Mapped[str] = mapped_column(String(20), unique=True)
    fecha: Mapped[date] = mapped_column(Date)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    impuestos: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    estado: Mapped[str] = mapped_column(String(20), default=EstadoFactura.emitida.value)

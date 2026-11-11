"""Modelos del módulo Inventario y Producción. Conservan el esquema del proyecto original."""

from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    ARRAY,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from novakey.db import Base

# Las seis estaciones de la línea del segundo piso (sección 13 del documento).
ESTACIONES = (
    "Almacén de componentes",
    "Ensamblaje de PCB",
    "Montaje del teclado",
    "Integración OLED",
    "Control de calidad",
    "Empaque y despacho",
)
ESTACION_CALIDAD = 4
ESTACION_EMPAQUE = 5


class EstadoOrdenProduccion(enum.StrEnum):
    planeada = "planeada"
    en_proceso = "en_proceso"
    terminada = "terminada"
    cancelada = "cancelada"


class ResultadoCalidad(enum.StrEnum):
    aprobada = "aprobada"
    rechazada = "rechazada"


class TipoMovimiento(enum.StrEnum):
    entrada_compra = "entrada_compra"
    salida_produccion = "salida_produccion"
    entrada_produccion = "entrada_produccion"
    salida_venta = "salida_venta"
    devolucion_venta = "devolucion_venta"
    ajuste = "ajuste"


class Material(Base):
    __tablename__ = "material"

    id: Mapped[int] = mapped_column("id_material", primary_key=True)
    codigo: Mapped[str] = mapped_column(String(30), unique=True)
    nombre: Mapped[str] = mapped_column(String(120))
    unidad_medida: Mapped[str] = mapped_column(String(10))
    stock_actual: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    stock_minimo: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    costo_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2))


class Producto(Base):
    __tablename__ = "producto"

    id: Mapped[int] = mapped_column("id_producto", primary_key=True)
    sku: Mapped[str] = mapped_column(String(30), unique=True)
    nombre: Mapped[str] = mapped_column(String(120))
    precio_venta: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    stock_actual: Mapped[int] = mapped_column(Integer)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class LineaMaterial(Base):
    __tablename__ = "lista_materiales"

    producto_id: Mapped[int] = mapped_column(
        "id_producto", ForeignKey("producto.id_producto"), primary_key=True
    )
    material_id: Mapped[int] = mapped_column(
        "id_material", ForeignKey("material.id_material"), primary_key=True
    )
    cantidad: Mapped[Decimal] = mapped_column(Numeric(12, 3))


class OrdenProduccion(Base):
    __tablename__ = "orden_produccion"

    id: Mapped[int] = mapped_column("id_orden_produccion", primary_key=True)
    producto_id: Mapped[int] = mapped_column("id_producto", ForeignKey("producto.id_producto"))
    usuario_id: Mapped[int] = mapped_column("id_usuario", ForeignKey("usuario.id_usuario"))
    cantidad: Mapped[int] = mapped_column(Integer)
    fecha_inicio: Mapped[date | None] = mapped_column(Date)
    fecha_fin: Mapped[date | None] = mapped_column(Date)
    estado: Mapped[str] = mapped_column(String(20), default=EstadoOrdenProduccion.planeada.value)
    # Unidades que superaron cada una de las seis estaciones de la línea.
    avance: Mapped[list[int]] = mapped_column(
        ARRAY(Integer), default=lambda: [0, 0, 0, 0, 0, 0], server_default="{0,0,0,0,0,0}"
    )


class ConsumoMaterial(Base):
    __tablename__ = "consumo_material"

    id: Mapped[int] = mapped_column("id_consumo", primary_key=True)
    orden_produccion_id: Mapped[int] = mapped_column(
        "id_orden_produccion", ForeignKey("orden_produccion.id_orden_produccion")
    )
    material_id: Mapped[int] = mapped_column("id_material", ForeignKey("material.id_material"))
    cantidad: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    fecha: Mapped[datetime] = mapped_column(DateTime)


class UnidadProducida(Base):
    __tablename__ = "unidad_producida"

    id: Mapped[int] = mapped_column("id_unidad", primary_key=True)
    orden_produccion_id: Mapped[int] = mapped_column(
        "id_orden_produccion", ForeignKey("orden_produccion.id_orden_produccion")
    )
    detalle_pedido_id: Mapped[int | None] = mapped_column("id_detalle_pedido")
    numero_serie: Mapped[str] = mapped_column(String(40), unique=True)
    resultado_calidad: Mapped[str] = mapped_column("resultado_calidad", String(20))
    fecha_ensamblaje: Mapped[datetime] = mapped_column(DateTime)


class MovimientoInventario(Base):
    __tablename__ = "movimiento_inventario"

    id: Mapped[int] = mapped_column("id_movimiento", primary_key=True)
    material_id: Mapped[int | None] = mapped_column(
        "id_material", ForeignKey("material.id_material")
    )
    producto_id: Mapped[int | None] = mapped_column(
        "id_producto", ForeignKey("producto.id_producto")
    )
    usuario_id: Mapped[int] = mapped_column("id_usuario", ForeignKey("usuario.id_usuario"))
    tipo: Mapped[str] = mapped_column(String(30))
    cantidad: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    documento_ref: Mapped[str] = mapped_column(String(40))
    fecha: Mapped[datetime] = mapped_column(DateTime)

"""Esquemas Pydantic del módulo Inventario y Producción."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from novakey.inventario.modelo import (
    ConsumoMaterial,
    LineaMaterial,
    Material,
    OrdenProduccion,
    Producto,
    UnidadProducida,
)


class MaterialOut(BaseModel):
    id: int
    codigo: str
    nombre: str
    unidad_medida: str
    stock_actual: Decimal
    stock_minimo: Decimal
    costo_unitario: Decimal

    @classmethod
    def de(cls, m: Material) -> MaterialOut:
        return cls.model_validate(m, from_attributes=True)


class ProductoOut(BaseModel):
    id: int
    sku: str
    nombre: str
    precio_venta: Decimal
    stock_actual: int
    activo: bool

    @classmethod
    def de(cls, p: Producto) -> ProductoOut:
        return cls.model_validate(p, from_attributes=True)


class LineaMaterialOut(BaseModel):
    producto_id: int
    material_id: int
    cantidad: Decimal

    @classmethod
    def de(cls, line: LineaMaterial) -> LineaMaterialOut:
        return cls.model_validate(line, from_attributes=True)


class OrdenProduccionOut(BaseModel):
    id: int
    producto_id: int
    usuario_id: int
    cantidad: int
    fecha_inicio: date | None
    fecha_fin: date | None
    estado: str
    avance: list[int]

    @classmethod
    def de(cls, o: OrdenProduccion) -> OrdenProduccionOut:
        return cls.model_validate(o, from_attributes=True)


class ConsumoOut(BaseModel):
    id: int
    orden_produccion_id: int
    material_id: int
    cantidad: Decimal
    fecha: datetime

    @classmethod
    def de(cls, c: ConsumoMaterial) -> ConsumoOut:
        return cls.model_validate(c, from_attributes=True)


class UnidadOut(BaseModel):
    id: int
    orden_produccion_id: int
    numero_serie: str
    resultado_calidad: str
    fecha_ensamblaje: datetime

    @classmethod
    def de(cls, u: UnidadProducida) -> UnidadOut:
        return cls.model_validate(u, from_attributes=True)


class MovimientoOut(BaseModel):
    id: int
    material_id: int | None
    producto_id: int | None
    usuario_id: int
    usuario: str | None
    tipo: str
    cantidad: Decimal
    documento_ref: str
    fecha: datetime


class NuevaOrden(BaseModel):
    producto_id: int
    cantidad: int = Field(gt=0, description="La cantidad debe ser un entero mayor que cero.")


class Avance(BaseModel):
    estacion: int = Field(ge=1, le=5)
    resultado: Literal["aprobada", "rechazada"] | None = None


class Ajuste(BaseModel):
    material_id: int | None = None
    producto_id: int | None = None
    cantidad: Decimal
    motivo: str = Field(min_length=1, max_length=40)

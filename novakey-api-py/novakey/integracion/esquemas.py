"""Esquemas Pydantic de la API externa (tienda en línea)."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, Field


class ProductoDisponible(BaseModel):
    """Catálogo que ve la tienda: lo justo para mostrar y vender, sin datos internos."""

    sku: str
    nombre: str
    precio_venta: Decimal
    disponible: int


class ClienteTienda(BaseModel):
    documento: str = Field(min_length=1)
    nombre: str = Field(min_length=1)
    email: str | None = None
    telefono: str | None = None
    direccion: str | None = None


class LineaTienda(BaseModel):
    sku: str = Field(min_length=1)
    cantidad: int = Field(gt=0)


class PedidoTienda(BaseModel):
    cliente: ClienteTienda
    lineas: list[LineaTienda] = Field(min_length=1)


class PedidoAceptado(BaseModel):
    pedido_id: int
    estado: str
    canal: str
    total: Decimal

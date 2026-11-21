"""API externa para la tienda en línea (RF06).

Dos capacidades, autenticadas con clave de API: consultar la disponibilidad de productos y
registrar un pedido por el canal ``web``. El registro reutiliza la lógica de Ventas, de modo que
la verificación de disponibilidad y la integridad del stock son las mismas del canal interno.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from novakey.db import get_session
from novakey.errores import NoEncontrado, ReglaNegocio
from novakey.integracion import esquemas as e
from novakey.integracion.arranque import obtener_usuario_tienda
from novakey.integracion.seguridad import verificar_api_key
from novakey.inventario.modelo import Producto
from novakey.ventas import servicio
from novakey.ventas.modelo import CanalPedido, Cliente

# Todas las rutas exigen la clave de API.
router = APIRouter(
    prefix="/tienda", tags=["integracion"], dependencies=[Depends(verificar_api_key)]
)

Sesion = Annotated[Session, Depends(get_session)]


@router.get("/catalogo", response_model=list[e.ProductoDisponible])
def catalogo(sesion: Sesion):
    """Productos activos con su precio y disponibilidad actual."""
    productos = sesion.scalars(
        select(Producto).where(Producto.activo.is_(True)).order_by(Producto.id)
    ).all()
    return [
        e.ProductoDisponible(
            sku=p.sku, nombre=p.nombre, precio_venta=p.precio_venta, disponible=p.stock_actual
        )
        for p in productos
    ]


@router.post("/pedidos", response_model=e.PedidoAceptado, status_code=status.HTTP_201_CREATED)
def registrar_pedido(p: e.PedidoTienda, sesion: Sesion):
    """Registra un pedido de la tienda. Rechaza (409) si no hay disponibilidad; todo o nada."""
    # Resuelve los productos por SKU y arma las líneas con el precio oficial del catálogo.
    lineas: list[servicio.LineaPedido] = []
    total = Decimal(0)
    for item in p.lineas:
        producto = sesion.scalar(select(Producto).where(Producto.sku == item.sku))
        if producto is None or not producto.activo:
            raise NoEncontrado(f"Producto no disponible: {item.sku}.")
        lineas.append(servicio.LineaPedido(producto.id, item.cantidad, producto.precio_venta))
        total += producto.precio_venta * item.cantidad

    cliente = _cliente(sesion, p.cliente)
    usuario = obtener_usuario_tienda(sesion)
    pedido = servicio.abrir_pedido(
        sesion, usuario.id, cliente.id, None, lineas, canal=CanalPedido.web
    )
    return e.PedidoAceptado(
        pedido_id=pedido.id, estado=pedido.estado, canal=pedido.canal, total=total
    )


def _cliente(sesion: Session, datos: e.ClienteTienda) -> Cliente:
    """Busca el cliente por documento o lo crea como cliente final de la tienda."""
    documento = datos.documento.strip()
    cliente = sesion.scalar(select(Cliente).where(Cliente.documento == documento))
    if cliente is not None:
        return cliente
    if not datos.nombre.strip():
        raise ReglaNegocio("El nombre del cliente es obligatorio.")
    cliente = Cliente(
        tipo="final",
        documento=documento,
        nombre=datos.nombre.strip(),
        email=datos.email,
        telefono=datos.telefono,
        direccion=datos.direccion,
    )
    sesion.add(cliente)
    sesion.flush()
    return cliente

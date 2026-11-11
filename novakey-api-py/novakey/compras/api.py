"""API REST del módulo Compras (RF03)."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from novakey.compras import esquemas as e
from novakey.compras.modelo import (
    CuentaPorPagar,
    DetalleOrdenCompra,
    EstadoCuenta,
    EstadoOrdenCompra,
    OrdenCompra,
    Proveedor,
)
from novakey.db import get_session
from novakey.errores import NoEncontrado, ReglaNegocio
from novakey.iam.modelo import Usuario
from novakey.iam.seguridad import exige
from novakey.inventario import existencias as stock

router = APIRouter(tags=["compras"])

Sesion = Annotated[Session, Depends(get_session)]

DIAS_CREDITO = 30


@router.get("/proveedores", response_model=list[e.ProveedorOut])
def proveedores(sesion: Sesion, _: Annotated[Usuario, Depends(exige("compras:ver"))]):
    filas = sesion.scalars(select(Proveedor).order_by(Proveedor.id)).all()
    return [e.ProveedorOut.de(p) for p in filas]


@router.post("/proveedores", response_model=e.ProveedorOut, status_code=status.HTTP_201_CREATED)
def crear_proveedor(
    n: e.NuevoProveedor, sesion: Sesion, _: Annotated[Usuario, Depends(exige("compras:editar"))]
):
    nit = n.nit.strip()
    if sesion.scalar(select(Proveedor).where(Proveedor.nit == nit)):
        raise ReglaNegocio("Ya existe un proveedor con ese NIT.")
    p = Proveedor(
        nit=nit,
        razon_social=n.razon_social.strip(),
        contacto=n.contacto,
        email=n.email,
        telefono=n.telefono,
    )
    sesion.add(p)
    sesion.flush()
    return e.ProveedorOut.de(p)


@router.get("/ordenes-compra", response_model=list[e.OrdenCompraOut])
def ordenes(sesion: Sesion, _: Annotated[Usuario, Depends(exige("compras:ver"))]):
    filas = sesion.scalars(select(OrdenCompra).order_by(OrdenCompra.id.desc())).all()
    return [e.OrdenCompraOut.de(o) for o in filas]


@router.post(
    "/ordenes-compra", response_model=e.OrdenCompraOut, status_code=status.HTTP_201_CREATED
)
def crear_orden(
    n: e.NuevaOrden,
    sesion: Sesion,
    usuario: Annotated[Usuario, Depends(exige("compras:editar"))],
):
    if sesion.get(Proveedor, n.proveedor_id) is None:
        raise NoEncontrado("El proveedor no existe.")
    o = OrdenCompra(
        proveedor_id=n.proveedor_id,
        usuario_id=usuario.id,
        fecha=date.today(),
        total=Decimal(0),
    )
    total = Decimal(0)
    for linea in n.lineas:
        o.detalles.append(
            DetalleOrdenCompra(
                material_id=linea.material_id,
                cantidad=linea.cantidad,
                precio_unitario=linea.precio_unitario,
            )
        )
        total += linea.cantidad * linea.precio_unitario
    o.total = total
    sesion.add(o)
    sesion.flush()
    return e.OrdenCompraOut.de(o)


def _bloquear_orden(sesion: Session, id: int) -> OrdenCompra:
    o = sesion.scalar(select(OrdenCompra).where(OrdenCompra.id == id).with_for_update())
    if o is None:
        raise NoEncontrado("La orden no existe.")
    return o


@router.post("/ordenes-compra/{id}/recepciones", response_model=e.OrdenCompraOut)
def recibir(
    id: int,
    r: e.Recepcion,
    sesion: Sesion,
    usuario: Annotated[Usuario, Depends(exige("compras:editar"))],
):
    """Suma existencias, actualiza la orden y abona a la cuenta por pagar; todo o nada."""
    o = _bloquear_orden(sesion, id)
    if o.estado in (EstadoOrdenCompra.recibida.value, EstadoOrdenCompra.cancelada.value):
        raise ReglaNegocio("La orden no admite recepciones.")

    ref = f"OC-{id:04d}"
    valor = Decimal(0)
    # Se recorre por id de material para bloquear en el mismo orden que producción (evita bloqueos).
    for d in sorted(o.detalles, key=lambda x: x.material_id):
        cantidad = r.cantidades.get(d.id, Decimal(0))
        if cantidad < 0 or cantidad > d.pendiente():
            raise ReglaNegocio(
                f"La cantidad recibida supera lo pendiente ({d.pendiente().normalize()})."
            )
        if cantidad == 0:
            continue
        d.cantidad_recibida = d.cantidad_recibida + cantidad
        valor += cantidad * d.precio_unitario
        stock.entrada_compra(sesion, usuario.id, d.material_id, cantidad, ref)

    if valor == 0:
        raise ReglaNegocio("Indica al menos una cantidad recibida.")

    o.estado = (
        EstadoOrdenCompra.recibida.value
        if all(d.pendiente() == 0 for d in o.detalles)
        else EstadoOrdenCompra.parcial.value
    )

    cuenta = sesion.scalar(
        select(CuentaPorPagar).where(CuentaPorPagar.orden_compra_id == id).with_for_update()
    )
    if cuenta is None:
        cuenta = CuentaPorPagar(
            orden_compra_id=id,
            monto=Decimal(0),
            saldo=Decimal(0),
            fecha_vencimiento=date.today() + timedelta(days=DIAS_CREDITO),
        )
        sesion.add(cuenta)
    cuenta.monto = cuenta.monto + valor
    cuenta.saldo = cuenta.saldo + valor
    cuenta.estado = EstadoCuenta.abierta.value
    sesion.flush()
    return e.OrdenCompraOut.de(o)


@router.get("/cuentas-por-pagar", response_model=list[e.CuentaOut])
def cuentas(sesion: Sesion, _: Annotated[Usuario, Depends(exige("compras:ver"))]):
    filas = sesion.scalars(select(CuentaPorPagar).order_by(CuentaPorPagar.id)).all()
    return [e.CuentaOut.de(c) for c in filas]


@router.post("/cuentas-por-pagar/{id}/pagos", response_model=e.CuentaOut)
def pagar(
    id: int, p: e.Pago, sesion: Sesion, _: Annotated[Usuario, Depends(exige("compras:editar"))]
):
    c = sesion.scalar(select(CuentaPorPagar).where(CuentaPorPagar.id == id).with_for_update())
    if c is None:
        raise NoEncontrado("La cuenta no existe.")
    if p.monto > c.saldo:
        raise ReglaNegocio("El pago no puede superar el saldo.")
    c.saldo = c.saldo - p.monto
    if c.saldo == 0:
        c.estado = EstadoCuenta.pagada.value
    return e.CuentaOut.de(c)

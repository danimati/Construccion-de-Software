"""API REST del módulo Inventario y Producción (RF02)."""

from __future__ import annotations

import math
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from novakey.db import get_session
from novakey.errores import NoEncontrado, ReglaNegocio
from novakey.iam.modelo import Usuario
from novakey.iam.seguridad import exige, exige_alguno
from novakey.inventario import esquemas as e
from novakey.inventario import existencias as stock
from novakey.inventario.modelo import (
    ESTACION_CALIDAD,
    ESTACION_EMPAQUE,
    ESTACIONES,
    ConsumoMaterial,
    EstadoOrdenProduccion,
    LineaMaterial,
    Material,
    MovimientoInventario,
    OrdenProduccion,
    Producto,
    ResultadoCalidad,
    TipoMovimiento,
    UnidadProducida,
)

router = APIRouter(tags=["inventario"])

Sesion = Annotated[Session, Depends(get_session)]


def _ahora() -> datetime:
    return datetime.now().replace(microsecond=0)


def _doc(id: int) -> str:
    return f"OP-{id:04d}"


# ---------------- Catálogos ----------------


@router.get("/materiales", response_model=list[e.MaterialOut])
def materiales(
    sesion: Sesion,
    _: Annotated[Usuario, Depends(exige_alguno("inventario:ver", "produccion:ver", "compras:ver"))],
):
    filas = sesion.scalars(select(Material).order_by(Material.id)).all()
    return [e.MaterialOut.de(m) for m in filas]


@router.get("/productos", response_model=list[e.ProductoOut])
def productos(
    sesion: Sesion,
    _: Annotated[Usuario, Depends(exige_alguno("inventario:ver", "produccion:ver", "ventas:ver"))],
):
    filas = sesion.scalars(select(Producto).order_by(Producto.id)).all()
    return [e.ProductoOut.de(p) for p in filas]


@router.get("/lista-materiales", response_model=list[e.LineaMaterialOut])
def lista_materiales(
    sesion: Sesion,
    _: Annotated[Usuario, Depends(exige_alguno("inventario:ver", "produccion:ver"))],
):
    filas = sesion.scalars(select(LineaMaterial)).all()
    return [e.LineaMaterialOut.de(line) for line in filas]


# ---------------- Movimientos ----------------


@router.get("/movimientos", response_model=list[e.MovimientoOut])
def movimientos(
    sesion: Sesion,
    _: Annotated[Usuario, Depends(exige("inventario:ver"))],
    limite: int = Query(200, ge=1, le=1000),
):
    # El nombre de usuario se resuelve aquí para no exigir el permiso de Accesos a quien consulta.
    nombres = {u.id: u.username for u in sesion.scalars(select(Usuario)).all()}
    filas = (
        sesion.scalars(
            select(MovimientoInventario).order_by(MovimientoInventario.id.desc()).limit(limite)
        ).all()
    )
    return [
        e.MovimientoOut(
            id=m.id,
            material_id=m.material_id,
            producto_id=m.producto_id,
            usuario_id=m.usuario_id,
            usuario=nombres.get(m.usuario_id),
            tipo=m.tipo,
            cantidad=m.cantidad,
            documento_ref=m.documento_ref,
            fecha=m.fecha,
        )
        for m in filas
    ]


@router.post("/movimientos/ajustes", status_code=status.HTTP_201_CREATED)
def ajustar(
    a: e.Ajuste, sesion: Sesion, usuario: Annotated[Usuario, Depends(exige("inventario:editar"))]
):
    if a.cantidad == 0:
        raise ReglaNegocio("Indica una cantidad distinta de cero.")
    if (a.material_id is None) == (a.producto_id is None):
        raise ReglaNegocio("Selecciona un material o producto.")

    if a.material_id is not None:
        m = sesion.scalar(select(Material).where(Material.id == a.material_id).with_for_update())
        if m is None:
            raise NoEncontrado("Material no encontrado.")
        nuevo = m.stock_actual + a.cantidad
        if nuevo < 0:
            raise ReglaNegocio(f"{m.nombre}: solo hay {m.stock_actual.normalize()} en stock.")
        m.stock_actual = nuevo
    else:
        if a.cantidad != a.cantidad.to_integral_value():
            raise ReglaNegocio("Los productos se ajustan en unidades enteras.")
        p = sesion.scalar(select(Producto).where(Producto.id == a.producto_id).with_for_update())
        if p is None:
            raise NoEncontrado("Producto no encontrado.")
        nuevo = p.stock_actual + int(a.cantidad)
        if nuevo < 0:
            raise ReglaNegocio(f"{p.nombre}: solo hay {p.stock_actual} en stock.")
        p.stock_actual = nuevo

    stock.registrar(
        sesion,
        usuario.id,
        TipoMovimiento.ajuste,
        a.cantidad,
        a.motivo.strip(),
        material_id=a.material_id,
        producto_id=a.producto_id,
    )
    return {"estado": "registrado"}


# ---------------- Órdenes de producción ----------------


@router.get("/ordenes-produccion", response_model=list[e.OrdenProduccionOut])
def ordenes(sesion: Sesion, _: Annotated[Usuario, Depends(exige("produccion:ver"))]):
    filas = sesion.scalars(select(OrdenProduccion).order_by(OrdenProduccion.id.desc())).all()
    return [e.OrdenProduccionOut.de(o) for o in filas]


@router.post(
    "/ordenes-produccion",
    response_model=e.OrdenProduccionOut,
    status_code=status.HTTP_201_CREATED,
)
def crear_orden(
    n: e.NuevaOrden,
    sesion: Sesion,
    usuario: Annotated[Usuario, Depends(exige("produccion:editar"))],
):
    if sesion.get(Producto, n.producto_id) is None:
        raise NoEncontrado("Producto no encontrado.")
    tiene_lista = sesion.scalar(
        select(LineaMaterial).where(LineaMaterial.producto_id == n.producto_id)
    )
    if tiene_lista is None:
        raise ReglaNegocio("El producto no tiene lista de materiales.")
    o = OrdenProduccion(producto_id=n.producto_id, usuario_id=usuario.id, cantidad=n.cantidad)
    sesion.add(o)
    sesion.flush()
    return e.OrdenProduccionOut.de(o)


def _bloquear_orden(sesion: Session, id: int) -> OrdenProduccion:
    o = sesion.scalar(
        select(OrdenProduccion).where(OrdenProduccion.id == id).with_for_update()
    )
    if o is None:
        raise NoEncontrado("La orden no existe.")
    return o


@router.post("/ordenes-produccion/{id}/iniciar", response_model=e.OrdenProduccionOut)
def iniciar(
    id: int,
    sesion: Sesion,
    usuario: Annotated[Usuario, Depends(exige("produccion:editar"))],
):
    """Consume todos los materiales de la lista; si falta alguno, no se descuenta ninguno."""
    o = _bloquear_orden(sesion, id)
    if o.estado != EstadoOrdenProduccion.planeada.value:
        raise ReglaNegocio("La orden no está planeada.")

    faltantes: list[str] = []
    ahora = _ahora()
    lineas = sesion.scalars(
        select(LineaMaterial)
        .where(LineaMaterial.producto_id == o.producto_id)
        .order_by(LineaMaterial.material_id)
    ).all()
    for linea in lineas:
        m = sesion.scalar(
            select(Material).where(Material.id == linea.material_id).with_for_update()
        )
        requerido = linea.cantidad * o.cantidad
        falta = requerido - m.stock_actual
        if falta > 0:
            faltantes.append(f"{m.nombre} (faltan {math.ceil(falta)})")
            continue
        m.stock_actual = m.stock_actual - requerido
        sesion.add(
            ConsumoMaterial(
                orden_produccion_id=id, material_id=m.id, cantidad=requerido, fecha=ahora
            )
        )
        stock.registrar(
            sesion,
            usuario.id,
            TipoMovimiento.salida_produccion,
            requerido,
            _doc(id),
            material_id=m.id,
        )

    if faltantes:
        raise ReglaNegocio("Material insuficiente: " + ", ".join(faltantes) + ".")

    o.estado = EstadoOrdenProduccion.en_proceso.value
    o.fecha_inicio = date.today()
    o.avance = [o.cantidad, 0, 0, 0, 0, 0]
    return e.OrdenProduccionOut.de(o)


@router.post("/ordenes-produccion/{id}/cancelar", response_model=e.OrdenProduccionOut)
def cancelar(id: int, sesion: Sesion, _: Annotated[Usuario, Depends(exige("produccion:editar"))]):
    o = _bloquear_orden(sesion, id)
    if o.estado != EstadoOrdenProduccion.planeada.value:
        raise ReglaNegocio("Solo se cancelan órdenes planeadas.")
    o.estado = EstadoOrdenProduccion.cancelada.value
    return e.OrdenProduccionOut.de(o)


@router.post("/ordenes-produccion/{id}/avance", response_model=e.OrdenProduccionOut)
def avanzar(
    id: int,
    a: e.Avance,
    sesion: Sesion,
    usuario: Annotated[Usuario, Depends(exige("produccion:editar"))],
):
    """Avanza una unidad en una estación; en calidad asigna el número de serie."""
    o = _bloquear_orden(sesion, id)
    if o.estado != EstadoOrdenProduccion.en_proceso.value:
        raise ReglaNegocio("La orden no está en proceso.")

    estacion = a.estacion
    avance = list(o.avance)
    aprobadas = _contar_aprobadas(sesion, id)
    limite = aprobadas if estacion == ESTACION_EMPAQUE else avance[estacion - 1]
    if avance[estacion] >= limite:
        raise ReglaNegocio(f"No hay unidades pendientes en {ESTACIONES[estacion]}.")

    if estacion == ESTACION_CALIDAD:
        if a.resultado is None:
            raise ReglaNegocio("Indica el resultado de calidad.")
        producto = sesion.get(Producto, o.producto_id)
        sufijo = producto.sku.split("-")[-1]
        serie = _siguiente_serie(sesion)
        sesion.add(
            UnidadProducida(
                orden_produccion_id=id,
                numero_serie=f"NK{sufijo}-{date.today().year}-{serie:06d}",
                resultado_calidad=a.resultado,
                fecha_ensamblaje=_ahora(),
            )
        )
        if a.resultado == ResultadoCalidad.aprobada.value:
            aprobadas += 1

    avance[estacion] += 1
    o.avance = avance

    if estacion == ESTACION_EMPAQUE:
        producto = sesion.scalar(
            select(Producto).where(Producto.id == o.producto_id).with_for_update()
        )
        producto.stock_actual = producto.stock_actual + 1
        stock.registrar(
            sesion,
            usuario.id,
            TipoMovimiento.entrada_produccion,
            Decimal(1),
            _doc(id),
            producto_id=producto.id,
        )

    if avance[ESTACION_CALIDAD] == o.cantidad and avance[ESTACION_EMPAQUE] == aprobadas:
        o.estado = EstadoOrdenProduccion.terminada.value
        o.fecha_fin = date.today()
    return e.OrdenProduccionOut.de(o)


def _contar_aprobadas(sesion: Session, orden_id: int) -> int:
    from sqlalchemy import func

    return sesion.scalar(
        select(func.count())
        .select_from(UnidadProducida)
        .where(
            UnidadProducida.orden_produccion_id == orden_id,
            UnidadProducida.resultado_calidad == ResultadoCalidad.aprobada.value,
        )
    )


def _siguiente_serie(sesion: Session) -> int:
    from sqlalchemy import text

    return sesion.scalar(text("select nextval('numero_serie_seq')"))


@router.get("/consumos", response_model=list[e.ConsumoOut])
def consumos(sesion: Sesion, _: Annotated[Usuario, Depends(exige("produccion:ver"))]):
    filas = sesion.scalars(select(ConsumoMaterial)).all()
    return [e.ConsumoOut.de(c) for c in filas]


@router.get("/unidades", response_model=list[e.UnidadOut])
def unidades(sesion: Sesion, _: Annotated[Usuario, Depends(exige("produccion:ver"))]):
    filas = sesion.scalars(select(UnidadProducida)).all()
    return [e.UnidadOut.de(u) for u in filas]

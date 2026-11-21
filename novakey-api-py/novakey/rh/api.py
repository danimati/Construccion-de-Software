"""API REST del módulo Recursos Humanos (RF05)."""

from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from novakey.db import get_session
from novakey.errores import NoEncontrado, ReglaNegocio
from novakey.iam.modelo import Usuario
from novakey.iam.puertos import ConsultaEmpleados, registrar_consulta_empleados
from novakey.iam.seguridad import exige, exige_alguno
from novakey.rh import esquemas as e
from novakey.rh.modelo import (
    Area,
    Cargo,
    DetalleNomina,
    Empleado,
    EstadoEmpleado,
    EstadoNomina,
    Horario,
    Nomina,
)

router = APIRouter(tags=["rh"])

Sesion = Annotated[Session, Depends(get_session)]

# Salud 4 % + pensión 4 % sobre el salario base. Simplificación, no liquidación legal completa.
TASA_DEDUCCION = Decimal("0.08")


# ---------------- Puerto ConsultaEmpleados (para IAM) ----------------


class ConsultaEmpleadosRh(ConsultaEmpleados):
    """Implementación real del puerto que IAM usa para mostrar el nombre del empleado."""

    def nombre_completo(self, sesion: Session, empleado_id: int) -> str | None:
        emp = sesion.get(Empleado, empleado_id)
        return f"{emp.nombres} {emp.apellidos}" if emp else None


# Se registra al importar el módulo, de modo que la sesión de IAM resuelva nombres reales.
registrar_consulta_empleados(ConsultaEmpleadosRh())


# ---------------- Catálogos ----------------


@router.get("/areas", response_model=list[e.AreaOut])
def areas(sesion: Sesion, _: Annotated[Usuario, Depends(exige("rh:ver"))]):
    return [e.AreaOut.de(a) for a in sesion.scalars(select(Area).order_by(Area.id)).all()]


@router.get("/cargos", response_model=list[e.CargoOut])
def cargos(sesion: Sesion, _: Annotated[Usuario, Depends(exige("rh:ver"))]):
    return [e.CargoOut.de(c) for c in sesion.scalars(select(Cargo).order_by(Cargo.id)).all()]


# ---------------- Empleados ----------------


@router.get("/empleados", response_model=list[e.EmpleadoOut])
def empleados(sesion: Sesion, _: Annotated[Usuario, Depends(exige("rh:ver"))]):
    filas = sesion.scalars(select(Empleado).order_by(Empleado.id)).all()
    return [e.EmpleadoOut.de(x) for x in filas]


@router.get("/empleados/resumen", response_model=list[e.EmpleadoResumen])
def resumen(sesion: Sesion, _: Annotated[Usuario, Depends(exige_alguno("rh:ver", "accesos:ver"))]):
    filas = sesion.scalars(select(Empleado).order_by(Empleado.id)).all()
    return [e.EmpleadoResumen(id=x.id, nombres=x.nombres, apellidos=x.apellidos) for x in filas]


@router.post("/empleados", response_model=e.EmpleadoOut, status_code=status.HTTP_201_CREATED)
def crear_empleado(
    n: e.NuevoEmpleado, sesion: Sesion, _: Annotated[Usuario, Depends(exige("rh:editar"))]
):
    if n.hora_inicio >= n.hora_fin:
        raise ReglaNegocio("La hora de inicio debe ser anterior a la de fin.")
    documento = n.documento.strip()
    if sesion.scalar(select(Empleado).where(Empleado.documento == documento)):
        raise ReglaNegocio("Ya existe un empleado con ese documento.")
    if sesion.get(Cargo, n.cargo_id) is None:
        raise NoEncontrado("El cargo no existe.")
    emp = Empleado(
        cargo_id=n.cargo_id,
        documento=documento,
        nombres=n.nombres.strip(),
        apellidos=n.apellidos.strip(),
        email=n.email,
        telefono=n.telefono,
        fecha_ingreso=n.fecha_ingreso,
    )
    sesion.add(emp)
    sesion.flush()
    # Horario de lunes (1) a viernes (5) con la jornada indicada.
    for dia in range(1, 6):
        sesion.add(
            Horario(
                empleado_id=emp.id,
                dia_semana=dia,
                hora_inicio=n.hora_inicio,
                hora_fin=n.hora_fin,
            )
        )
    return e.EmpleadoOut.de(emp)


@router.put("/empleados/{id}/estado", response_model=e.EmpleadoOut)
def cambiar_estado(
    id: int, c: e.CambioEstado, sesion: Sesion, _: Annotated[Usuario, Depends(exige("rh:editar"))]
):
    emp = sesion.get(Empleado, id)
    if emp is None:
        raise NoEncontrado("El empleado no existe.")
    emp.estado = c.estado
    return e.EmpleadoOut.de(emp)


@router.get("/horarios", response_model=list[e.HorarioOut])
def horarios(sesion: Sesion, _: Annotated[Usuario, Depends(exige("rh:ver"))]):
    filas = sesion.scalars(select(Horario).order_by(Horario.id)).all()
    return [e.HorarioOut.de(h) for h in filas]


# ---------------- Nóminas ----------------


@router.get("/nominas", response_model=list[e.NominaOut])
def nominas(sesion: Sesion, _: Annotated[Usuario, Depends(exige("rh:ver"))]):
    filas = sesion.scalars(select(Nomina).order_by(Nomina.id.desc())).all()
    return [e.NominaOut.de(n) for n in filas]


@router.post("/nominas", response_model=e.NominaOut, status_code=status.HTTP_201_CREATED)
def generar_nomina(sesion: Sesion, _: Annotated[Usuario, Depends(exige("rh:editar"))]):
    """Genera en borrador la nómina del mes siguiente al último liquidado."""
    hay_borrador = sesion.scalar(
        select(Nomina).where(Nomina.estado == EstadoNomina.borrador.value)
    )
    if hay_borrador is not None:
        raise ReglaNegocio("Paga la nómina en borrador antes de generar otra.")

    ultima = sesion.scalar(select(Nomina).order_by(Nomina.id.desc()))
    if ultima is not None:
        base = ultima.periodo_fin + relativedelta(months=1)
    else:
        base = date.today()
    inicio = base.replace(day=1)
    fin = (inicio + relativedelta(months=1)) - relativedelta(days=1)

    n = Nomina(periodo_inicio=inicio, periodo_fin=fin, fecha_pago=fin)
    activos = sesion.scalars(
        select(Empleado).where(Empleado.estado != EstadoEmpleado.retirado.value)
    ).all()
    for emp in activos:
        salario = sesion.get(Cargo, emp.cargo_id).salario_base
        deducciones = (salario * TASA_DEDUCCION).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        n.detalles.append(
            DetalleNomina(
                empleado_id=emp.id,
                salario_base=salario,
                devengados=Decimal(0),
                deducciones=deducciones,
                neto_pagar=salario - deducciones,
            )
        )
    sesion.add(n)
    sesion.flush()
    return e.NominaOut.de(n)


@router.put("/nominas/{id}/detalles/{detalle_id}/devengados", response_model=e.NominaOut)
def fijar_devengados(
    id: int,
    detalle_id: int,
    c: e.CambioDevengados,
    sesion: Sesion,
    _: Annotated[Usuario, Depends(exige("rh:editar"))],
):
    n = sesion.get(Nomina, id)
    if n is None:
        raise NoEncontrado("La nómina no existe.")
    if n.estado != EstadoNomina.borrador.value:
        raise ReglaNegocio("Solo se edita una nómina en borrador.")
    d = next((x for x in n.detalles if x.id == detalle_id), None)
    if d is None:
        raise NoEncontrado("Detalle no encontrado.")
    d.devengados = c.devengados
    d.neto_pagar = d.salario_base + c.devengados - d.deducciones
    return e.NominaOut.de(n)


@router.post("/nominas/{id}/pagar", response_model=e.NominaOut)
def pagar_nomina(id: int, sesion: Sesion, _: Annotated[Usuario, Depends(exige("rh:editar"))]):
    n = sesion.get(Nomina, id)
    if n is None:
        raise NoEncontrado("La nómina no existe.")
    if n.estado != EstadoNomina.borrador.value:
        raise ReglaNegocio("La nómina no está en borrador.")
    n.estado = EstadoNomina.pagada.value
    n.fecha_pago = date.today()
    return e.NominaOut.de(n)

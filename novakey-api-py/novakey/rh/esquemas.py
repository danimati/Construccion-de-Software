"""Esquemas Pydantic del módulo Recursos Humanos."""

from __future__ import annotations

from datetime import date, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from novakey.rh.modelo import Area, Cargo, Empleado, Horario, Nomina


class AreaOut(BaseModel):
    id: int
    nombre: str

    @classmethod
    def de(cls, a: Area) -> AreaOut:
        return cls.model_validate(a, from_attributes=True)


class CargoOut(BaseModel):
    id: int
    area_id: int
    nombre: str
    salario_base: Decimal

    @classmethod
    def de(cls, c: Cargo) -> CargoOut:
        return cls.model_validate(c, from_attributes=True)


class EmpleadoOut(BaseModel):
    id: int
    cargo_id: int
    documento: str
    nombres: str
    apellidos: str
    email: str | None
    telefono: str | None
    fecha_ingreso: date
    estado: str

    @classmethod
    def de(cls, e: Empleado) -> EmpleadoOut:
        return cls.model_validate(e, from_attributes=True)


class EmpleadoResumen(BaseModel):
    """Lo mínimo que necesita Accesos: sin documento, contacto ni datos laborales."""

    id: int
    nombres: str
    apellidos: str


class HorarioOut(BaseModel):
    id: int
    empleado_id: int
    dia_semana: int
    hora_inicio: time
    hora_fin: time

    @classmethod
    def de(cls, h: Horario) -> HorarioOut:
        return cls.model_validate(h, from_attributes=True)


class DetalleNominaOut(BaseModel):
    id: int
    empleado_id: int
    salario_base: Decimal
    devengados: Decimal
    deducciones: Decimal
    neto_pagar: Decimal


class NominaOut(BaseModel):
    id: int
    periodo_inicio: date
    periodo_fin: date
    fecha_pago: date
    estado: str
    detalles: list[DetalleNominaOut]

    @classmethod
    def de(cls, n: Nomina) -> NominaOut:
        return cls(
            id=n.id,
            periodo_inicio=n.periodo_inicio,
            periodo_fin=n.periodo_fin,
            fecha_pago=n.fecha_pago,
            estado=n.estado,
            detalles=[
                DetalleNominaOut(
                    id=d.id,
                    empleado_id=d.empleado_id,
                    salario_base=d.salario_base,
                    devengados=d.devengados,
                    deducciones=d.deducciones,
                    neto_pagar=d.neto_pagar,
                )
                for d in sorted(n.detalles, key=lambda x: x.empleado_id)
            ],
        )


class NuevoEmpleado(BaseModel):
    cargo_id: int
    documento: str = Field(min_length=1)
    nombres: str = Field(min_length=1)
    apellidos: str = Field(min_length=1)
    email: str | None = None
    telefono: str | None = None
    fecha_ingreso: date
    hora_inicio: time
    hora_fin: time


class CambioEstado(BaseModel):
    estado: Literal["activo", "vacaciones", "retirado"]


class CambioDevengados(BaseModel):
    devengados: Decimal = Field(ge=0)

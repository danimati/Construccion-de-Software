"""Modelos del módulo Recursos Humanos. Conservan el esquema del proyecto original."""

from __future__ import annotations

import enum
from datetime import date, time
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, SmallInteger, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from novakey.db import Base


class EstadoEmpleado(enum.StrEnum):
    activo = "activo"
    vacaciones = "vacaciones"
    retirado = "retirado"


class EstadoNomina(enum.StrEnum):
    borrador = "borrador"
    pagada = "pagada"


class Area(Base):
    __tablename__ = "area"

    id: Mapped[int] = mapped_column("id_area", primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80), unique=True)


class Cargo(Base):
    __tablename__ = "cargo"

    id: Mapped[int] = mapped_column("id_cargo", primary_key=True)
    area_id: Mapped[int] = mapped_column("id_area", ForeignKey("area.id_area"))
    nombre: Mapped[str] = mapped_column(String(80))
    salario_base: Mapped[Decimal] = mapped_column(Numeric(12, 2))


class Empleado(Base):
    __tablename__ = "empleado"

    id: Mapped[int] = mapped_column("id_empleado", primary_key=True)
    cargo_id: Mapped[int] = mapped_column("id_cargo", ForeignKey("cargo.id_cargo"))
    documento: Mapped[str] = mapped_column(String(20), unique=True)
    nombres: Mapped[str] = mapped_column(String(80))
    apellidos: Mapped[str] = mapped_column(String(80))
    email: Mapped[str | None] = mapped_column(String(120))
    telefono: Mapped[str | None] = mapped_column(String(20))
    fecha_ingreso: Mapped[date] = mapped_column("fecha_ingreso", Date)
    estado: Mapped[str] = mapped_column(String(20), default=EstadoEmpleado.activo.value)


class Horario(Base):
    __tablename__ = "horario"

    id: Mapped[int] = mapped_column("id_horario", primary_key=True)
    empleado_id: Mapped[int] = mapped_column("id_empleado", ForeignKey("empleado.id_empleado"))
    dia_semana: Mapped[int] = mapped_column("dia_semana", SmallInteger)
    hora_inicio: Mapped[time] = mapped_column("hora_inicio", Time)
    hora_fin: Mapped[time] = mapped_column("hora_fin", Time)


class DetalleNomina(Base):
    __tablename__ = "detalle_nomina"

    id: Mapped[int] = mapped_column("id_detalle_nomina", primary_key=True)
    nomina_id: Mapped[int] = mapped_column("id_nomina", ForeignKey("nomina.id_nomina"))
    empleado_id: Mapped[int] = mapped_column("id_empleado", ForeignKey("empleado.id_empleado"))
    salario_base: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    devengados: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    deducciones: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    neto_pagar: Mapped[Decimal] = mapped_column("neto_pagar", Numeric(12, 2))


class Nomina(Base):
    __tablename__ = "nomina"

    id: Mapped[int] = mapped_column("id_nomina", primary_key=True)
    periodo_inicio: Mapped[date] = mapped_column("periodo_inicio", Date, unique=True)
    periodo_fin: Mapped[date] = mapped_column("periodo_fin", Date)
    fecha_pago: Mapped[date] = mapped_column("fecha_pago", Date)
    estado: Mapped[str] = mapped_column(String(20), default=EstadoNomina.borrador.value)

    detalles: Mapped[list[DetalleNomina]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )

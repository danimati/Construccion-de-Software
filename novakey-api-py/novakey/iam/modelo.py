"""Modelos del módulo IAM. Los nombres de tabla y columna conservan el esquema del proyecto."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Table, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from novakey.db import Base

# Los módulos del ERP sobre los que se conceden permisos.
MODULOS: tuple[str, ...] = ("ventas", "inventario", "produccion", "compras", "rh", "accesos")

# Id del rol Administrador TI: nunca puede perder la gestión de accesos.
ROL_ADMIN_ID = 6

rol_permiso = Table(
    "rol_permiso",
    Base.metadata,
    Column("id_rol", ForeignKey("rol.id_rol"), primary_key=True),
    Column("id_permiso", ForeignKey("permiso.id_permiso"), primary_key=True),
)

usuario_rol = Table(
    "usuario_rol",
    Base.metadata,
    Column("id_usuario", ForeignKey("usuario.id_usuario"), primary_key=True),
    Column("id_rol", ForeignKey("rol.id_rol"), primary_key=True),
)


class Permiso(Base):
    __tablename__ = "permiso"

    id: Mapped[int] = mapped_column("id_permiso", primary_key=True)
    codigo: Mapped[str] = mapped_column(String(40), unique=True)
    modulo: Mapped[str] = mapped_column(String(20))
    descripcion: Mapped[str | None] = mapped_column(String(120))


class Rol(Base):
    __tablename__ = "rol"

    id: Mapped[int] = mapped_column("id_rol", primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80), unique=True)
    descripcion: Mapped[str | None] = mapped_column(String(160))

    permisos: Mapped[list[Permiso]] = relationship(secondary=rol_permiso, lazy="selectin")


class Usuario(Base):
    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column("id_usuario", primary_key=True)
    empleado_id: Mapped[int | None] = mapped_column("id_empleado")
    username: Mapped[str] = mapped_column(String(50), unique=True)
    email: Mapped[str] = mapped_column(String(120), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    creado_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    roles: Mapped[list[Rol]] = relationship(secondary=usuario_rol, lazy="selectin")

    def codigos_permiso(self) -> set[str]:
        """Códigos de permiso (p. ej. ``ventas:editar``) reunidos de todos sus roles."""
        return {p.codigo for rol in self.roles for p in rol.permisos}


def niveles(codigos: set[str]) -> dict[str, str | None]:
    """Traduce los códigos a un nivel por módulo: {'ventas': 'editar', 'rh': None, ...}."""
    salida: dict[str, str | None] = {}
    for modulo in MODULOS:
        if f"{modulo}:editar" in codigos:
            salida[modulo] = "editar"
        elif f"{modulo}:ver" in codigos:
            salida[modulo] = "ver"
        else:
            salida[modulo] = None
    return salida

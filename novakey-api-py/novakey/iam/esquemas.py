"""Esquemas Pydantic del módulo IAM (validación de entrada y forma de salida)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from novakey.iam.modelo import MODULOS, Rol, Usuario, niveles


class Credenciales(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class Sesion(BaseModel):
    id: int
    username: str
    nombre: str
    roles: list[str]
    permisos: dict[str, str | None]


class Login(BaseModel):
    token: str
    expira: datetime
    usuario: Sesion


class UsuarioOut(BaseModel):
    id: int
    empleado_id: int | None
    username: str
    email: str
    activo: bool
    rol_ids: list[int]

    @classmethod
    def de(cls, u: Usuario) -> UsuarioOut:
        return cls(
            id=u.id,
            empleado_id=u.empleado_id,
            username=u.username,
            email=u.email,
            activo=u.activo,
            rol_ids=sorted(r.id for r in u.roles),
        )


class RolOut(BaseModel):
    id: int
    nombre: str
    descripcion: str | None
    permisos: dict[str, str | None]

    @classmethod
    def de(cls, r: Rol) -> RolOut:
        return cls(
            id=r.id,
            nombre=r.nombre,
            descripcion=r.descripcion,
            permisos=niveles({p.codigo for p in r.permisos}),
        )


class NuevoUsuario(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    empleado_id: int | None = None
    rol_id: int


class CambioRol(BaseModel):
    rol_id: int


class CambioActivo(BaseModel):
    activo: bool


class CambioPermiso(BaseModel):
    # None retira el acceso al módulo; 'ver'/'editar' lo fija.
    nivel: Literal["ver", "editar"] | None = None


def modulo_valido(modulo: str) -> bool:
    return modulo in MODULOS

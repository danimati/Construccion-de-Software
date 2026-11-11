"""API REST del módulo IAM (RF01): autenticación, usuarios, roles y permisos."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from novakey.comun.seguridad import emitir_token, hash_clave, verificar_clave
from novakey.db import get_session
from novakey.errores import NoAutorizado, NoEncontrado, ReglaNegocio
from novakey.iam import esquemas as e
from novakey.iam.modelo import MODULOS, ROL_ADMIN_ID, Permiso, Rol, Usuario, niveles
from novakey.iam.puertos import consulta_empleados
from novakey.iam.seguridad import UsuarioActual, exige

router = APIRouter(tags=["iam"])

Sesion = Annotated[Session, Depends(get_session)]

# Hash fijo para igualar el tiempo de respuesta cuando el usuario no existe (evita enumeración).
_HASH_SEÑUELO = hash_clave("señuelo-para-igualar-tiempos")


def _sesion_dto(sesion: Session, u: Usuario) -> e.Sesion:
    nombre = u.username
    if u.empleado_id is not None:
        nombre = consulta_empleados.nombre_completo(sesion, u.empleado_id) or u.username

    return e.Sesion(
        id=u.id,
        username=u.username,
        nombre=nombre,
        roles=sorted(r.nombre for r in u.roles),
        permisos=niveles(u.codigos_permiso()),
    )


@router.post("/auth/login", response_model=e.Login)
def login(cred: e.Credenciales, sesion: Sesion) -> e.Login:
    usuario = sesion.scalar(
        select(Usuario).where(Usuario.username == cred.username.strip(), Usuario.activo.is_(True))
    )
    # Aunque el usuario no exista se verifica un hash, para no delatar la diferencia por tiempo.
    hash_ref = usuario.password_hash if usuario else _HASH_SEÑUELO
    valida = verificar_clave(cred.password, hash_ref)
    if usuario is None or not valida:
        raise NoAutorizado("Usuario o contraseña incorrectos.")

    token, expira = emitir_token(usuario.id)
    return e.Login(token=token, expira=expira, usuario=_sesion_dto(sesion, usuario))


@router.get("/auth/me", response_model=e.Sesion)
def yo(usuario: UsuarioActual, sesion: Sesion) -> e.Sesion:
    return _sesion_dto(sesion, usuario)


@router.get("/usuarios", response_model=list[e.UsuarioOut])
def usuarios(sesion: Sesion, _: Annotated[Usuario, Depends(exige("accesos:ver"))]):
    filas = sesion.scalars(select(Usuario).order_by(Usuario.id)).all()
    return [e.UsuarioOut.de(u) for u in filas]


@router.post("/usuarios", response_model=e.UsuarioOut, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    n: e.NuevoUsuario, sesion: Sesion, _: Annotated[Usuario, Depends(exige("accesos:editar"))]
):
    username = n.username.strip()
    email = n.email.strip()
    if sesion.scalar(select(Usuario).where(Usuario.username == username)):
        raise ReglaNegocio("Ese nombre de usuario ya existe.")
    if sesion.scalar(select(Usuario).where(Usuario.email == email)):
        raise ReglaNegocio("Ese correo ya está registrado.")
    rol = sesion.get(Rol, n.rol_id)
    if rol is None:
        raise NoEncontrado("El rol no existe.")

    u = Usuario(
        username=username,
        email=email,
        empleado_id=n.empleado_id,
        password_hash=hash_clave(n.password),
        roles=[rol],
    )
    sesion.add(u)
    sesion.flush()
    return e.UsuarioOut.de(u)


@router.put("/usuarios/{id}/rol", response_model=e.UsuarioOut)
def cambiar_rol(
    id: int,
    c: e.CambioRol,
    sesion: Sesion,
    actual: Annotated[Usuario, Depends(exige("accesos:editar"))],
):
    if id == actual.id:
        raise ReglaNegocio("No puedes cambiar tu propio rol.")
    u = sesion.get(Usuario, id)
    if u is None:
        raise NoEncontrado("El usuario no existe.")
    rol = sesion.get(Rol, c.rol_id)
    if rol is None:
        raise NoEncontrado("El rol no existe.")
    u.roles = [rol]
    sesion.flush()
    return e.UsuarioOut.de(u)


@router.put("/usuarios/{id}/activo", response_model=e.UsuarioOut)
def cambiar_activo(
    id: int,
    c: e.CambioActivo,
    sesion: Sesion,
    actual: Annotated[Usuario, Depends(exige("accesos:editar"))],
):
    if id == actual.id:
        raise ReglaNegocio("No puedes desactivar tu propio usuario.")
    u = sesion.get(Usuario, id)
    if u is None:
        raise NoEncontrado("El usuario no existe.")
    u.activo = c.activo
    sesion.flush()
    return e.UsuarioOut.de(u)


@router.get("/roles", response_model=list[e.RolOut])
def roles(sesion: Sesion, _: Annotated[Usuario, Depends(exige("accesos:ver"))]):
    filas = sesion.scalars(select(Rol).order_by(Rol.id)).all()
    return [e.RolOut.de(r) for r in filas]


@router.put("/roles/{id}/permisos/{modulo}", response_model=e.RolOut)
def fijar_permiso(
    id: int,
    modulo: str,
    c: e.CambioPermiso,
    sesion: Sesion,
    _: Annotated[Usuario, Depends(exige("accesos:editar"))],
):
    if modulo not in MODULOS:
        raise NoEncontrado("El módulo no existe.")
    if id == ROL_ADMIN_ID and modulo == "accesos":
        raise ReglaNegocio("El administrador debe conservar la gestión de accesos.")
    rol = sesion.get(Rol, id)
    if rol is None:
        raise NoEncontrado("El rol no existe.")

    # Quita los permisos del módulo y, si hay nivel, añade los correspondientes.
    rol.permisos = [p for p in rol.permisos if p.modulo != modulo]
    if c.nivel is not None:
        candidatos = sesion.scalars(select(Permiso).where(Permiso.modulo == modulo)).all()
        for p in candidatos:
            if c.nivel == "editar" or p.codigo.endswith(":ver"):
                rol.permisos.append(p)
    sesion.flush()
    return e.RolOut.de(rol)

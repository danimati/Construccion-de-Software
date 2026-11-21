"""Autenticación y autorización del monolito.

El token solo identifica al usuario; los permisos se leen de la base en cada petición, de modo
que desactivar un usuario o cambiar un rol surte efecto de inmediato, sin esperar a que caduque
el token. Esto replica la decisión de diseño del proyecto original.
"""

from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from novakey.comun.seguridad import leer_token
from novakey.db import get_session
from novakey.errores import NoAutorizado, Prohibido
from novakey.iam.modelo import Usuario

# auto_error=False: devolvemos nuestro propio 401 RFC 9457 en vez del de FastAPI.
_esquema = HTTPBearer(auto_error=False)


def usuario_actual(
    request: Request,
    credenciales: Annotated[HTTPAuthorizationCredentials | None, Depends(_esquema)],
    sesion: Annotated[Session, Depends(get_session)],
) -> Usuario:
    """Resuelve el usuario del token. Falla con 401 si el token o el usuario no son válidos."""
    if credenciales is None:
        raise NoAutorizado("Falta el token de acceso.")
    try:
        usuario_id = leer_token(credenciales.credentials)
    except jwt.PyJWTError:
        raise NoAutorizado("Token inválido o expirado.") from None

    usuario = sesion.get(Usuario, usuario_id)
    if usuario is None or not usuario.activo:
        raise NoAutorizado("Usuario inactivo o inexistente.")

    # Se cachea en la petición para que varias dependencias no repitan la consulta.
    request.state.usuario = usuario
    return usuario


UsuarioActual = Annotated[Usuario, Depends(usuario_actual)]


def exige(codigo: str):
    """Crea una dependencia que exige un permiso concreto (p. ej. ``ventas:editar``).

    Si el usuario tiene ``modulo:editar`` también se considera que puede ``modulo:ver``.
    """
    modulo, nivel = codigo.split(":")

    def verificar(usuario: UsuarioActual) -> Usuario:
        if not _tiene(usuario, codigo):
            raise Prohibido("No tienes permiso para esta operación.")
        return usuario

    return verificar


def exige_alguno(*codigos: str):
    """Crea una dependencia que exige al menos uno de los permisos indicados."""

    def verificar(usuario: UsuarioActual) -> Usuario:
        if not any(_tiene(usuario, c) for c in codigos):
            raise Prohibido("No tienes permiso para esta operación.")
        return usuario

    return verificar


def _tiene(usuario: Usuario, codigo: str) -> bool:
    modulo, nivel = codigo.split(":")
    codigos = usuario.codigos_permiso()
    return codigo in codigos or (nivel == "ver" and f"{modulo}:editar" in codigos)

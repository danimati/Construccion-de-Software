"""Usuario de sistema para los pedidos de la tienda.

Los movimientos de inventario exigen un usuario para la trazabilidad. La tienda no es una persona,
así que se usa un usuario de sistema 'tienda', inactivo (no puede iniciar sesión) y sin roles.
"""

from __future__ import annotations

import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from novakey.comun.seguridad import hash_clave
from novakey.iam.modelo import Usuario

USERNAME_TIENDA = "tienda"


def obtener_usuario_tienda(sesion: Session) -> Usuario:
    """Devuelve el usuario de sistema 'tienda', creándolo si no existe."""
    usuario = sesion.scalar(select(Usuario).where(Usuario.username == USERNAME_TIENDA))
    if usuario is None:
        usuario = Usuario(
            username=USERNAME_TIENDA,
            email="tienda@novakey.invalid",
            # Contraseña aleatoria imposible de usar: este usuario no inicia sesión.
            password_hash=hash_clave(secrets.token_urlsafe(32)),
            activo=False,
        )
        sesion.add(usuario)
        sesion.flush()
    return usuario

"""Creación del primer administrador en una instalación nueva.

Equivale a ``AdminInicial`` de la versión Spring: si se define ``NOVAKEY_ADMIN_CLAVE`` y no hay
usuarios, crea ``admin`` con el rol Administrador TI en el primer arranque.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from novakey.comun.seguridad import hash_clave
from novakey.config import get_settings
from novakey.iam.modelo import ROL_ADMIN_ID, Rol, Usuario


def crear_admin_inicial(sesion: Session) -> None:
    clave = get_settings().admin_clave
    if not clave.strip():
        return
    if sesion.scalar(select(func.count()).select_from(Usuario)):
        return
    rol = sesion.get(Rol, ROL_ADMIN_ID)
    if rol is None:
        return
    sesion.add(
        Usuario(
            username="admin",
            email="admin@novakey.invalid",
            password_hash=hash_clave(clave),
            roles=[rol],
        )
    )
    sesion.commit()

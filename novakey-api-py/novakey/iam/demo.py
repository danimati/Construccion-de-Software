"""Datos de demostración del módulo IAM (solo con el perfil ``demo``).

Crea un usuario por rol con una contraseña conocida, para los botones de la pantalla de login.
En producción (cualquier otro perfil) estos usuarios y el endpoint no existen.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from novakey.comun.seguridad import hash_clave
from novakey.db import get_session
from novakey.iam.modelo import Rol, Usuario

CLAVE = "novakey"

router = APIRouter(tags=["demo"])

# Un usuario por rol (id de rol -> username).
_USUARIOS_DEMO: dict[int, tuple[str, str]] = {
    1: ("mquintero", "mquintero@novakey.example"),
    2: ("ecampos", "ecampos@novakey.example"),
    3: ("princon", "princon@novakey.example"),
    4: ("jsalcedo", "jsalcedo@novakey.example"),
    5: ("nmedina", "nmedina@novakey.example"),
    6: ("slinares", "slinares@novakey.example"),
}


class AccesoDemo(BaseModel):
    username: str
    rol: str
    password: str


def sembrar_si_vacio(sesion: Session) -> None:
    if sesion.scalar(select(func.count()).select_from(Usuario)) == 0:
        _reiniciar(sesion)


def _reiniciar(sesion: Session) -> None:
    sesion.execute(Usuario.__table__.delete())
    clave = hash_clave(CLAVE)
    for rol_id, (username, email) in _USUARIOS_DEMO.items():
        rol = sesion.get(Rol, rol_id)
        if rol is None:
            continue
        sesion.add(
            Usuario(username=username, email=email, password_hash=clave, roles=[rol])
        )
    sesion.flush()


Sesion = Annotated[Session, Depends(get_session)]


@router.get("/demo/accesos", response_model=list[AccesoDemo])
def accesos(sesion: Sesion) -> list[AccesoDemo]:
    salida: list[AccesoDemo] = []
    for rol in sesion.scalars(select(Rol).order_by(Rol.id)):
        usuario = sesion.scalar(
            select(Usuario)
            .where(Usuario.activo.is_(True))
            .where(Usuario.roles.any(Rol.id == rol.id))
            .order_by(Usuario.id)
        )
        if usuario:
            salida.append(AccesoDemo(username=usuario.username, rol=rol.nombre, password=CLAVE))
    return salida


@router.post("/demo/reiniciar", status_code=200)
def reiniciar(sesion: Sesion) -> dict[str, str]:
    _reiniciar(sesion)
    return {"estado": "reiniciado"}

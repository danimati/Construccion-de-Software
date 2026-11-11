"""Autenticación de la API externa: clave de API por cabecera ``X-API-Key``.

La tienda es un sistema externo, no un usuario con rol, así que se autentica con una clave de
API independiente del JWT. Si no hay clave configurada, la integración queda deshabilitada.
"""

from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import Depends
from fastapi.security import APIKeyHeader

from novakey.config import get_settings
from novakey.errores import NoAutorizado

_esquema = APIKeyHeader(name="X-API-Key", auto_error=False)


def verificar_api_key(clave: Annotated[str | None, Depends(_esquema)]) -> None:
    esperada = get_settings().tienda_api_key
    if not esperada:
        raise NoAutorizado("La integración con la tienda está deshabilitada.")
    # Comparación en tiempo constante para no filtrar la clave por tiempo de respuesta.
    if clave is None or not secrets.compare_digest(clave, esperada):
        raise NoAutorizado("Clave de API no válida.")

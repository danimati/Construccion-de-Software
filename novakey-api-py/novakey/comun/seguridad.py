"""Seguridad compartida: hashing de contraseñas (pwdlib + Argon2) y tokens (PyJWT)."""

from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from novakey.config import get_settings

# pwdlib con Argon2 como algoritmo recomendado.
_hasher = PasswordHash.recommended()

_EMISOR = "novakey-api"
_ALGORITMO = "HS256"


def hash_clave(clave: str) -> str:
    """Devuelve el hash Argon2 de una contraseña en claro."""
    return _hasher.hash(clave)


def verificar_clave(clave: str, hash_almacenado: str) -> bool:
    """Comprueba una contraseña contra su hash. No lanza si el hash es inválido."""
    try:
        return _hasher.verify(clave, hash_almacenado)
    except Exception:
        return False


def emitir_token(usuario_id: int) -> tuple[str, datetime]:
    """Firma un JWT con el id del usuario como ``sub``. Devuelve (token, expiración)."""
    settings = get_settings()
    ahora = datetime.now(UTC)
    expira = ahora + timedelta(hours=settings.jwt_horas)
    payload = {
        "iss": _EMISOR,
        "sub": str(usuario_id),
        "iat": int(ahora.timestamp()),
        "exp": int(expira.timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secreto, algorithm=_ALGORITMO)
    return token, expira


def leer_token(token: str) -> int:
    """Valida la firma y la expiración y devuelve el id del usuario. Lanza en caso de error."""
    settings = get_settings()
    datos = jwt.decode(
        token,
        settings.jwt_secreto,
        algorithms=[_ALGORITMO],
        issuer=_EMISOR,
        options={"require": ["exp", "sub", "iss"]},
    )
    return int(datos["sub"])

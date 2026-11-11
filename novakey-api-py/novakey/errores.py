"""Errores de dominio y respuestas RFC 9457 (application/problem+json).

El campo ``detail`` contiene el mensaje para el usuario. Una regla de negocio incumplida
responde 409, igual que en la especificación del proyecto.
"""

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

PROBLEM_JSON = "application/problem+json"


class ErrorDominio(Exception):
    """Base de los errores de negocio con un estado HTTP asociado."""

    estado: int = status.HTTP_400_BAD_REQUEST

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class NoEncontrado(ErrorDominio):
    estado = status.HTTP_404_NOT_FOUND


class ReglaNegocio(ErrorDominio):
    """Regla de negocio incumplida. Responde 409 Conflict."""

    estado = status.HTTP_409_CONFLICT


class NoAutorizado(ErrorDominio):
    estado = status.HTTP_401_UNAUTHORIZED


class Prohibido(ErrorDominio):
    estado = status.HTTP_403_FORBIDDEN


def _problema(estado: int, detail: str) -> JSONResponse:
    return JSONResponse(
        status_code=estado,
        media_type=PROBLEM_JSON,
        content={"status": estado, "detail": detail},
    )


def registrar_manejadores(app: FastAPI) -> None:
    """Conecta los manejadores para que todas las respuestas de error sigan RFC 9457."""

    @app.exception_handler(ErrorDominio)
    async def _dominio(_: Request, exc: ErrorDominio) -> JSONResponse:
        return _problema(exc.estado, exc.detail)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _problema(exc.status_code, str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def _validacion(_: Request, exc: RequestValidationError) -> JSONResponse:
        errores = exc.errors()
        detail = errores[0]["msg"] if errores else "Datos no válidos."
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            media_type=PROBLEM_JSON,
            content={"status": 422, "detail": detail, "errores": jsonable_encoder(errores)},
        )

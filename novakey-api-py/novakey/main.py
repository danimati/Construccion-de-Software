"""Punto de entrada de la API. Ensambla el monolito modular montando el router de cada módulo."""

from fastapi import FastAPI

from novakey import __version__
from novakey.config import get_settings
from novakey.errores import registrar_manejadores


def crear_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="NovaKey ERP API",
        version=__version__,
        description="Monolito modular del ERP NovaKey: IAM, Inventario, Compras, Ventas y RH.",
    )

    registrar_manejadores(app)

    @app.get("/actuator/health", tags=["infra"])
    def health() -> dict[str, str]:
        return {"status": "UP"}

    # Los módulos se registran aquí a medida que se implementan (RF01..RF06).
    # from novakey.iam.api import router as iam_router
    # app.include_router(iam_router, prefix="/api")

    _ = settings  # se usará para activar el perfil demo cuando existan los módulos
    return app


app = crear_app()

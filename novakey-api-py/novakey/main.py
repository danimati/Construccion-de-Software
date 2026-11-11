"""Punto de entrada de la API. Ensambla el monolito modular montando el router de cada módulo."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from novakey import __version__
from novakey.config import get_settings
from novakey.db import SessionLocal
from novakey.errores import registrar_manejadores


@asynccontextmanager
async def ciclo_vida(app: FastAPI):
    """Al arrancar: crea el admin inicial y, en perfil demo, siembra datos de ejemplo."""
    settings = get_settings()
    from novakey.iam.arranque import crear_admin_inicial

    with SessionLocal() as sesion:
        crear_admin_inicial(sesion)
        if settings.perfil == "demo":
            from novakey.compras.demo import sembrar_si_vacio as sembrar_compras
            from novakey.iam.demo import sembrar_si_vacio as sembrar_iam
            from novakey.inventario.demo import sembrar_si_vacio as sembrar_inventario
            from novakey.ventas.demo import sembrar_si_vacio as sembrar_ventas

            sembrar_iam(sesion)
            sembrar_inventario(sesion)
            sembrar_compras(sesion)
            sembrar_ventas(sesion)
            sesion.commit()
    yield


def crear_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="NovaKey ERP API",
        version=__version__,
        description="Monolito modular del ERP NovaKey: IAM, Inventario, Compras, Ventas y RH.",
        lifespan=ciclo_vida,
    )

    registrar_manejadores(app)

    @app.get("/actuator/health", tags=["infra"])
    def health() -> dict[str, str]:
        return {"status": "UP"}

    # RF01 · IAM
    from novakey.iam.api import router as iam_router

    app.include_router(iam_router, prefix="/api")

    # RF02 · Inventario y Producción
    from novakey.inventario.api import router as inventario_router

    app.include_router(inventario_router, prefix="/api")

    # RF03 · Compras
    from novakey.compras.api import router as compras_router

    app.include_router(compras_router, prefix="/api")

    # RF04 · Ventas
    from novakey.ventas.api import router as ventas_router

    app.include_router(ventas_router, prefix="/api")

    # Router de demostración solo con el perfil demo.
    if settings.perfil == "demo":
        from novakey.iam.demo import router as demo_router

        app.include_router(demo_router, prefix="/api")

    return app


app = crear_app()

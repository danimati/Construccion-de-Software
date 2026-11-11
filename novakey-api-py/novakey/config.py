"""Configuración de la aplicación, leída de variables de entorno."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Parámetros de ejecución. El prefijo NOVAKEY_ mantiene la convención del proyecto."""

    model_config = SettingsConfigDict(env_prefix="NOVAKEY_", env_file=".env", extra="ignore")

    # Conexión a PostgreSQL 16.
    db_url: str = "postgresql+psycopg://novakey:novakey@localhost:5433/novakey"

    # Firma de tokens JWT. Mínimo 32 bytes; sin un valor seguro la API no debe usarse en producción.
    jwt_secreto: str = "secreto-solo-para-demostracion-no-usar-en-produccion"
    jwt_horas: int = 12

    # Si no hay usuarios, crea 'admin' con rol Administrador TI en el primer arranque.
    admin_clave: str = ""

    # Perfil activo: 'demo' carga datos ficticios; cualquier otro valor los omite.
    perfil: str = "demo"

    # Clave de API para la integración con la tienda en línea (RF06). Si está vacía, la API
    # externa queda deshabilitada. En demo se usa un valor conocido para poder probarla.
    tienda_api_key: str = "clave-tienda-demo"

    def validar(self) -> None:
        if len(self.jwt_secreto.encode("utf-8")) < 32:
            raise ValueError("NOVAKEY_JWT_SECRETO debe tener al menos 32 bytes")


@lru_cache
def get_settings() -> Settings:
    return Settings()

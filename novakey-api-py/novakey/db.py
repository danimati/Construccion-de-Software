"""Motor de base de datos y sesión por petición.

Cada módulo define sus modelos sobre la misma ``Base`` declarativa, de modo que el monolito
comparte un único esquema pero cada módulo es responsable de las escrituras de sus tablas.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from novakey.config import get_settings


class Base(DeclarativeBase):
    """Base declarativa compartida por todos los módulos."""


_settings = get_settings()
engine = create_engine(_settings.db_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def get_session() -> Generator[Session, None, None]:
    """Dependencia de FastAPI: abre una sesión, hace commit si todo fue bien y la cierra.

    Cada petición es una transacción. Si el endpoint lanza una excepción se revierte,
    cumpliendo el requisito de integridad por transacción.
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

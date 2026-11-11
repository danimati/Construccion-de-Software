"""Entorno de Alembic. Toma la URL de la configuración de la app y usa la metadata compartida."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from novakey.config import get_settings
from novakey.db import Base

# Importar aquí los modelos de cada módulo para que Alembic los vea en autogenerate.
# from novakey.iam import modelo  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", get_settings().db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

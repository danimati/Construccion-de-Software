#!/bin/sh
# Arranque del contenedor de la API: aplica las migraciones y luego lanza Uvicorn.
# Alembic no corre solo al iniciar FastAPI, así que el esquema se actualiza aquí.
set -e

echo "Aplicando migraciones (alembic upgrade head)..."
alembic upgrade head

echo "Iniciando Uvicorn en el puerto 8080..."
exec uvicorn novakey.main:app --host 0.0.0.0 --port 8080

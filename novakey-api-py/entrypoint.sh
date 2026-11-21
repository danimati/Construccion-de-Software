#!/bin/sh
# Arranque del contenedor de la API: aplica las migraciones y luego lanza Uvicorn.
# Alembic no corre solo al iniciar FastAPI, así que el esquema se actualiza aquí.
set -e

echo "Aplicando migraciones (alembic upgrade head)..."
alembic upgrade head

# Varios procesos de Uvicorn reparten la carga entre los núcleos disponibles; el valor se ajusta
# con NOVAKEY_WORKERS (la prueba de carga con k6 validó 8 workers para 100 usuarios en 8 núcleos).
WORKERS="${NOVAKEY_WORKERS:-8}"
echo "Iniciando Uvicorn en el puerto 8080 con ${WORKERS} workers..."
exec uvicorn novakey.main:app --host 0.0.0.0 --port 8080 --workers "${WORKERS}" --proxy-headers

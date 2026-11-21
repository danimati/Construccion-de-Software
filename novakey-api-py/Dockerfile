# Imagen de la API NovaKey (FastAPI + Uvicorn) sobre Python 3.12.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Instala dependencias primero para aprovechar la caché de capas.
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

COPY novakey ./novakey
COPY migrations ./migrations
COPY alembic.ini entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Usuario sin privilegios.
RUN useradd --create-home novakey
USER novakey

EXPOSE 8080
# El arranque aplica las migraciones (alembic upgrade head) antes de lanzar Uvicorn.
ENTRYPOINT ["./entrypoint.sh"]

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
COPY alembic.ini ./

# Usuario sin privilegios.
RUN useradd --create-home novakey
USER novakey

EXPOSE 8080
CMD ["uvicorn", "novakey.main:app", "--host", "0.0.0.0", "--port", "8080"]

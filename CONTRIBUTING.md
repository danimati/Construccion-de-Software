# Flujo de trabajo de NovaKey

## Ramas

- `main`: código estable y desplegable. No se hace push directo.
- `develop`: rama de integración donde confluyen las features.
- `feature/*`: una rama por funcionalidad o componente. Sale de `develop` y vuelve a `develop` por Pull Request.

Convención de nombres: `feature/rf01-iam`, `feature/ci-cd`, `feature/frontend-react`, etc.

## Ciclo

1. Crea tu rama desde `develop`:
   ```bash
   git checkout develop
   git checkout -b feature/mi-cambio
   ```
2. Trabaja, haz commits pequeños y descriptivos (estilo Conventional Commits: `feat:`, `fix:`, `docs:`...).
3. Abre un Pull Request hacia `develop`. CI debe pasar en verde antes de fusionar.
4. Cuando `develop` está estable, se fusiona a `main` y se etiqueta una versión (`vX.Y.Z`), lo que dispara el despliegue.

## Integración continua (CI)

`.github/workflows/ci.yml` corre en cada push y PR:

- **Backend**: `ruff check` + `pytest` con cobertura, contra un PostgreSQL 16 real.
- **Frontend**: `npm ci`, pruebas y `npm run build`.
- **Docker**: build de las imágenes de API y Web.

Los jobs detectan si la carpeta correspondiente existe en la rama, de modo que las ramas
tempranas (antes de integrar backend o frontend) no fallan.

## Despliegue continuo (CD)

`.github/workflows/cd.yml` publica las imágenes en GitHub Container Registry al etiquetar
una versión `vX.Y.Z` o mediante ejecución manual.

## Calidad antes de hacer push

```bash
# Backend
cd novakey-api-py && ruff check . && pytest

# Frontend
cd novakey-web && npm test -- --run && npm run build
```

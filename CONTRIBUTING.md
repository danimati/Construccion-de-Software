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

## Entrega y despliegue (CD)

1. **Liberar:** fusionar `develop` en `main` por Pull Request y crear la etiqueta `vX.Y.Z` sobre `main`.
2. **Publicar** (`.github/workflows/cd.yml`, automático con la etiqueta): construye las imágenes
   `novakey-api` y `novakey-web` y las publica en GitHub Container Registry.
3. **Ensayo** (mismo workflow): levanta esas imágenes con Docker Compose y ejecuta la prueba de
   humo de `infra/desplegar.sh` (salud de la API, interfaz por HTTPS, `/api` vía Nginx y
   redirección HTTP → HTTPS).
4. **Aprobar y desplegar** (`.github/workflows/desplegar.yml`, manual): un integrante ejecuta
   "Desplegar" con la versión verificada; el job usa el entorno `production`, se conecta por SSH
   al servidor y ejecuta `infra/desplegar.sh`. Requiere los secretos `DEPLOY_HOST`, `DEPLOY_USER`
   y `DEPLOY_SSH_KEY` en ese entorno, y que el servidor haya hecho `docker login ghcr.io`.

Respaldos, restauración y staging: ver `infra/respaldo/README.md`.
Pruebas de carga: ver `pruebas/carga/README.md`.

## Calidad antes de hacer push

```bash
# Backend
cd novakey-api-py && ruff check . && pytest

# Frontend
cd novakey-web && npm test -- --run && npm run build
```

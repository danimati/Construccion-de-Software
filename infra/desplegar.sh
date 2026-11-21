#!/bin/sh
# Despliega una versión publicada en GHCR con Docker Compose y ejecuta la prueba de humo.
#   NOVAKEY_REGISTRO=ghcr.io/<propietario> sh infra/desplegar.sh vX.Y.Z
# Se usa igual en el servidor (por SSH desde el workflow "Desplegar") y en el ensayo del CD.
set -eu

VERSION="${1:?Uso: desplegar.sh vX.Y.Z}"
export NOVAKEY_TAG="$VERSION"
: "${NOVAKEY_REGISTRO:?Defina NOVAKEY_REGISTRO, p. ej. ghcr.io/propietario}"
PUERTO="${NOVAKEY_HTTPS_PUERTO:-8443}"

echo "== Desplegando NovaKey $VERSION desde $NOVAKEY_REGISTRO"
docker compose pull api web
# La API aplica 'alembic upgrade head' al arrancar (entrypoint.sh).
docker compose up -d --no-build

echo "== Esperando a la API"
LISTO=0
for _ in $(seq 1 60); do
  if docker compose exec -T api python -c \
    "import urllib.request,sys; sys.exit(0 if b'UP' in urllib.request.urlopen('http://localhost:8080/actuator/health', timeout=3).read() else 1)" \
    2>/dev/null; then LISTO=1; break; fi
  sleep 3
done
[ "$LISTO" = 1 ] || { echo "La API no respondió"; docker compose logs --tail 80 api; exit 1; }
echo "API /actuator/health: UP"

codigo() { curl -s -o /dev/null -w '%{http_code}' "$@" || true; }

echo "== Prueba de humo"
# 1) Salud de la API dentro de la red interna: ya comprobada arriba.
# 2) Nginx sirve la interfaz por HTTPS (se espera a que acepte conexiones).
for _ in $(seq 1 20); do
  CODIGO="$(codigo -k "https://localhost:${PUERTO}/")"
  [ "$CODIGO" = 200 ] && break
  sleep 2
done
[ "$CODIGO" = 200 ] || { echo "Interfaz: HTTP $CODIGO"; exit 1; }
echo "Interfaz HTTPS: 200"
# 3) Nginx reenvía /api a FastAPI (un login vacío debe responder 422 de validación).
CODIGO="$(codigo -k -X POST "https://localhost:${PUERTO}/api/auth/login" \
  -H 'Content-Type: application/json' -d '{}')"
[ "$CODIGO" = 422 ] || { echo "API vía Nginx: HTTP $CODIGO"; exit 1; }
echo "API vía Nginx: 422 (validación de FastAPI)"
# 4) HTTP redirige a HTTPS.
CODIGO="$(codigo "http://localhost:${NOVAKEY_HTTP_PUERTO:-8080}/")"
[ "$CODIGO" = 301 ] || { echo "Redirección HTTP: $CODIGO"; exit 1; }
echo "HTTP -> HTTPS: 301"

docker compose ps
echo "== $VERSION desplegada y verificada"

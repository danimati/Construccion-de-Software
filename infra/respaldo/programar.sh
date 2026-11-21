#!/bin/sh
# Proceso del contenedor de respaldos: ejecuta respaldar.sh todos los días a la hora indicada.
#   HORA_RESPALDO (HH:MM, por defecto 02:00) · RESPALDO_AL_INICIAR=1 hace uno al arrancar.
set -eu

HORA="${HORA_RESPALDO:-02:00}"
DIR_SCRIPTS="$(dirname "$0")"

until pg_isready -q; do sleep 2; done

if [ "${RESPALDO_AL_INICIAR:-0}" = "1" ]; then
  sh "$DIR_SCRIPTS/respaldar.sh" || echo "[respaldo] ERROR en el respaldo inicial"
fi

while true; do
  AHORA="$(date +%s)"
  OBJETIVO="$(date -d "$(date +%Y-%m-%d) $HORA" +%s)"
  [ "$OBJETIVO" -le "$AHORA" ] && OBJETIVO=$((OBJETIVO + 86400))
  echo "[respaldo] próximo respaldo en $(( (OBJETIVO - AHORA) / 60 )) minutos ($HORA)"
  sleep $((OBJETIVO - AHORA))
  sh "$DIR_SCRIPTS/respaldar.sh" || echo "[respaldo] ERROR: el respaldo falló"
done

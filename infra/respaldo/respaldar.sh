#!/bin/sh
# Genera un respaldo comprimido de la base de NovaKey y aplica la retención.
#   Salida: ${DIR_RESPALDOS}/novakey_AAAAMMDD_HHMMSS.sql.gz
# Variables: PGHOST, PGUSER, PGPASSWORD, PGDATABASE, DIR_RESPALDOS, RETENCION_DIAS.
set -eu

DIR="${DIR_RESPALDOS:-/respaldos}"
DIAS="${RETENCION_DIAS:-14}"
mkdir -p "$DIR"

FECHA="$(date +%Y%m%d_%H%M%S)"
DESTINO="$DIR/novakey_${FECHA}.sql.gz"
TEMPORAL="$DESTINO.parcial"

# --clean --if-exists permite restaurar sobre una base existente.
pg_dump --clean --if-exists --no-owner --no-privileges | gzip -9 > "$TEMPORAL"
gzip -t "$TEMPORAL"
mv "$TEMPORAL" "$DESTINO"
echo "[respaldo] $(date -Iseconds) creado $DESTINO ($(du -h "$DESTINO" | cut -f1))"

# Retención: elimina respaldos con más de DIAS días.
find "$DIR" -name 'novakey_*.sql.gz' -type f -mtime +"$DIAS" -print -delete \
  | sed 's/^/[respaldo] eliminado por retención: /'

#!/bin/sh
# Prueba de restauración: un respaldo solo se considera confiable si se puede restaurar.
# Restaura el respaldo más reciente (o el indicado) en una base temporal, compara el número
# de filas de cada tabla con la base de origen y elimina la base temporal.
#   probar-restauracion.sh [archivo.sql.gz]
set -eu

DIR="${DIR_RESPALDOS:-/respaldos}"
ARCHIVO="${1:-$(ls -1t "$DIR"/novakey_*.sql.gz 2>/dev/null | head -n 1)}"
[ -n "$ARCHIVO" ] || { echo "[prueba] no hay respaldos en $DIR"; exit 1; }
TEMP="novakey_prueba_restauracion"

echo "[prueba] respaldo: $ARCHIVO"
psql -q -d postgres -c "DROP DATABASE IF EXISTS $TEMP" -c "CREATE DATABASE $TEMP"
trap 'psql -q -d postgres -c "DROP DATABASE IF EXISTS $TEMP"' EXIT

sh "$(dirname "$0")/restaurar.sh" "$ARCHIVO" "$TEMP"

# Conteo exacto de filas por tabla en una base.
conteos() {
  psql -At -d "$1" -c "SELECT table_name FROM information_schema.tables
                       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                       ORDER BY table_name" |
  while read -r t; do
    echo "$t $(psql -At -d "$1" -c "SELECT count(*) FROM \"$t\"")"
  done
}

conteos "$PGDATABASE" > /tmp/origen.txt
conteos "$TEMP" > /tmp/restaurada.txt

TABLAS="$(wc -l < /tmp/restaurada.txt | tr -d ' ')"
FILAS="$(awk '{s += $2} END {print s}' /tmp/restaurada.txt)"
if diff -u /tmp/origen.txt /tmp/restaurada.txt; then
  echo "[prueba] OK: $TABLAS tablas y $FILAS filas restauradas coinciden con la base de origen"
else
  echo "[prueba] DIFERENCIAS entre la base de origen y la restaurada (ver arriba)."
  echo "[prueba] Si hubo escrituras después del respaldo, las diferencias son esperables."
  exit 2
fi

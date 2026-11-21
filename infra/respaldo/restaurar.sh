#!/bin/sh
# Restaura un respaldo sobre la base indicada (por defecto PGDATABASE).
#   restaurar.sh <archivo.sql.gz> [base_destino]
# Úsese en staging para la prueba mensual o en producción ante pérdida de datos,
# con la API detenida para que no escriba durante la restauración.
set -eu

ARCHIVO="${1:?Uso: restaurar.sh <archivo.sql.gz> [base_destino]}"
BASE="${2:-$PGDATABASE}"

gzip -t "$ARCHIVO"
gunzip -c "$ARCHIVO" | psql -q -v ON_ERROR_STOP=1 -d "$BASE" > /dev/null
echo "[restauración] $ARCHIVO restaurado en la base '$BASE'"

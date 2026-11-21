# Respaldos, restauración y staging

## Respaldo diario

El servicio `backup` de `compose.yaml` (imagen `postgres:16-alpine`) ejecuta `respaldar.sh`
todos los días a las 02:00 (hora de Bogotá):

- `pg_dump --clean --if-exists` comprimido con gzip, verificado con `gzip -t`.
- Archivo `novakey_AAAAMMDD_HHMMSS.sql.gz` en la carpeta `NOVAKEY_DIR_RESPALDOS` del servidor
  (por defecto `./respaldos`), fuera de los contenedores y fuera de Git.
- Retención de 14 días (`NOVAKEY_RETENCION_DIAS`).

| Variable | Defecto | Uso |
|---|---|---|
| `NOVAKEY_HORA_RESPALDO` | `02:00` | Hora del respaldo diario |
| `NOVAKEY_RETENCION_DIAS` | `14` | Días que se conservan los respaldos |
| `NOVAKEY_DIR_RESPALDOS` | `./respaldos` | Carpeta del servidor donde se guardan |
| `NOVAKEY_RESPALDO_AL_INICIAR` | `0` | `1` hace un respaldo al arrancar el servicio |

Respaldo manual:

```bash
docker compose exec backup sh /scripts/respaldar.sh
```

## Prueba de restauración

Un respaldo solo es confiable si se puede restaurar. `probar-restauracion.sh` restaura el
respaldo más reciente en una base temporal, compara el número de filas de cada tabla con la base
de origen y elimina la base temporal:

```bash
docker compose exec backup sh /scripts/probar-restauracion.sh
```

## Restauración

Con la API detenida para que no escriba durante el proceso:

```bash
docker compose stop api
docker compose exec backup sh /scripts/restaurar.sh /respaldos/novakey_AAAAMMDD_HHMMSS.sql.gz
docker compose start api
```

## Staging

Staging usa el mismo `compose.yaml` con otro nombre de proyecto, otros puertos y su propia
carpeta de respaldos (`entornos/staging.env`): HTTPS en `https://localhost:8444`, HTTP en 8081 y
PostgreSQL en 5434.

```bash
docker compose -p novakey-staging --env-file entornos/staging.env up -d --build
```

La prueba mensual consiste en restaurar en staging el último respaldo de producción y
comprobar que la aplicación funciona con esos datos.

## Resultados de la verificación (21 de noviembre de 2026)

| Prueba | Resultado |
|---|---|
| Respaldo inicial de producción | `novakey_20261121_115706.sql.gz`, 92 KB, verificado con `gzip -t` |
| Prueba de restauración en base temporal | OK: 29 tablas y 16 865 filas idénticas a la base de origen |
| Staging levantado en paralelo a producción | OK: inicio de sesión en `https://localhost:8444` |
| Restauración del respaldo de producción en staging | OK: 5 560 cotizaciones en staging, igual que en producción; inicio de sesión correcto tras restaurar |

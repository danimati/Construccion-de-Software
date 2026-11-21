# Pruebas de carga con k6

Valida el requerimiento no funcional de capacidad: **100 usuarios concurrentes** con
**p95 < 500 ms** y **0 % de solicitudes fallidas**.

## Escenario (`k6-erp.js`)

100 usuarios virtuales repartidos en tres áreas que trabajan a través de Nginx por HTTPS,
igual que la interfaz web:

| Área | Usuarios | Operaciones por iteración |
|---|---|---|
| Producción (`princon`) | 34 | `GET productos`, `materiales`, `ordenes-produccion`, `movimientos` |
| Compras (`jsalcedo`) | 33 | `GET proveedores`, `ordenes-compra`, `cuentas-por-pagar` |
| Ventas (`ecampos`) | 33 | `GET clientes`, `pedidos` y `POST cotizaciones` (escritura transaccional con detalle) |

Cada usuario espera 1 s entre iteraciones. Rampa de 30 s hasta 100 usuarios, 2 min sostenidos y
15 s de bajada. El inicio de sesión se hace una vez por rol en `setup()`.

## Ejecución

```bash
docker compose up -d --build
docker run --rm --network novakey_default \
  -v "$PWD/pruebas/carga:/scripts:ro" \
  -v "$PWD/pruebas/carga/resultados:/resultados" \
  grafana/k6:0.54.0 run /scripts/k6-erp.js
```

El resumen completo queda en `resultados/resumen.json`.

## Resultados (21 de noviembre de 2026)

Equipo de pruebas: Docker Desktop con 8 CPU y 5,7 GB de RAM; k6 corre en la misma máquina.

| Corrida | Configuración de la API | Solicitudes | Req/s | p95 | Fallidas | Resultado |
|---|---|---|---|---|---|---|
| 1 | 1 proceso de Uvicorn, pool 5 + 10 | 2 193 | 11,2 | 60 000 ms | 10,58 % | No cumple |
| 2 | 4 workers, pool 10 + 10 por worker | 24 725 | 148,8 | 500,7 ms | 0,00 % | No cumple (p95 al límite) |
| 3 | **8 workers, pool 5 + 5 por worker** | **29 584** | **177,5** | **464,3 ms** | **0,00 %** | **Cumple** |

Detalle de la corrida 3 (`resultados/2026-11-21_8workers.json`): latencia promedio 182,3 ms,
mediana 142,1 ms, p90 367,5 ms, máximo 1 360 ms; 8 921 iteraciones y 100 % de checks
correctos (3 010 cotizaciones creadas sin error).

### Hallazgo y corrección

En la corrida 1 el único proceso de Uvicorn agotó el pool de conexiones de SQLAlchemy
(`QueuePool limit of size 5 overflow 10 reached`) y las peticiones esperaron hasta 60 s.
Se corrigió así:

- `entrypoint.sh` lanza Uvicorn con `--workers ${NOVAKEY_WORKERS:-8}`.
- `NOVAKEY_DB_POOL`, `NOVAKEY_DB_OVERFLOW` y `NOVAKEY_DB_POOL_TIMEOUT` configuran el pool. Con 8
  workers × (5 + 5) = 80 conexiones como máximo, por debajo de las 100 de PostgreSQL.
- El arranque usa un candado de PostgreSQL (`pg_advisory_lock`) para que los workers no
  siembren datos ni creen el administrador al mismo tiempo.

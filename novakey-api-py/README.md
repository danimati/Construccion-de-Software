# NovaKey ERP · API en FastAPI

Backend del ERP NovaKey: **monolito modular** en **Python 3.12** con **FastAPI** y **Uvicorn**,
**PostgreSQL 16**, **SQLAlchemy** como ORM, **Alembic** para migraciones, **PyJWT** para los
tokens y **Argon2** (vía `pwdlib`) para las contraseñas.

Esta carpeta es la reescritura al stack del documento `Esquema_NovaKey_Integrado_DevOps.pdf`,
que reemplazará al backend anterior en Spring Boot (`../novakey-api`) una vez completada.

## Estado

| Pieza | Estado |
|---|---|
| Esqueleto FastAPI + config + errores RFC 9457 | ✅ |
| SQLAlchemy (`Base`, sesión por petición transaccional) | ✅ |
| Alembic (entorno de migraciones) | ✅ |
| Seguridad base: PyJWT + Argon2 (`pwdlib`) | ✅ |
| **RF01 IAM** (usuarios, roles, permisos, login JWT) | ✅ |
| **RF02 Inventario y Producción** (materiales, productos, listas, órdenes, movimientos) | ✅ |
| **RF03 Compras** (proveedores, órdenes de compra, recepciones, cuentas por pagar) | ✅ |
| **RF04 Ventas** (clientes, cotizaciones, pedidos, facturación con IVA) | ✅ |
| RF05 RH · RF06 Integración | ⏳ pendiente |

### Módulo IAM (RF01)

| Ruta bajo `/api` | Descripción | Permiso |
|---|---|---|
| `POST auth/login` | Inicia sesión y emite un JWT (HS256) | público |
| `GET auth/me` | Sesión del usuario autenticado | token |
| `GET usuarios` · `POST usuarios` | Lista y crea usuarios | `accesos:ver` / `accesos:editar` |
| `PUT usuarios/{id}/rol` · `PUT usuarios/{id}/activo` | Cambia rol o estado | `accesos:editar` |
| `GET roles` · `PUT roles/{id}/permisos/{modulo}` | Lista roles y fija permisos | `accesos:ver` / `accesos:editar` |

Los permisos se leen de la base en cada petición: desactivar un usuario o cambiar un rol surte
efecto de inmediato. Con el perfil `demo` existen `GET demo/accesos` y `POST demo/reiniciar`.

## Requisitos

- Python 3.12+
- Docker (para PostgreSQL y las pruebas de integración)

## Desarrollo

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1        # PowerShell
pip install -e ".[dev]"

# Base de datos local (PostgreSQL 16 en el puerto 5433)
docker compose up -d db

# Arrancar la API
uvicorn novakey.main:app --reload --port 8080

# Pruebas
pytest
ruff check .
```

## Estructura

```
novakey/
  config.py        Configuración (variables NOVAKEY_*)
  db.py            Motor, Base declarativa y sesión por petición
  errores.py       Errores de dominio y respuestas RFC 9457
  main.py          Ensambla la app y monta el router de cada módulo
  comun/           Utilidades compartidas (seguridad: JWT + Argon2)
  iam/ ...         Un paquete por módulo del ERP (se añaden por rama feature/*)
migrations/        Alembic
tests/             pytest + HTTPX
```

## Configuración

| Variable | Descripción |
|---|---|
| `NOVAKEY_DB_URL` | Cadena de conexión SQLAlchemy a PostgreSQL |
| `NOVAKEY_JWT_SECRETO` | Firma de tokens. Mínimo 32 bytes |
| `NOVAKEY_JWT_HORAS` | Vigencia del token en horas (por defecto 12) |
| `NOVAKEY_ADMIN_CLAVE` | Crea `admin` en el primer arranque si no hay usuarios |
| `NOVAKEY_PERFIL` | `demo` carga datos ficticios; otro valor los omite |

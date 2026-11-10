# NovaKey ERP · API en Spring Boot

Backend del ERP descrito en *Esquema Empresa NovaKey*: monolito modular con Spring Boot 4.1, PostgreSQL 17,
Flyway, JWT y Argon2. El frontend está en `../novakey-erp`.

## Ejecutar

### Todo el sistema con Docker

```bash
(cd novakey-api && ./mvnw package -DskipTests)
(cd novakey-erp && npm install && npm run build)
docker compose up -d --build     # desde la carpeta que contiene compose.yaml
```

Abre <http://localhost:8088>. Los usuarios de demostración están en `../novakey-erp/README.md`.

### Para desarrollar

Requiere Java 17 y Docker. Las pruebas usan Testcontainers, así que Docker debe estar activo.

```bash
docker compose up -d db                                    # PostgreSQL en el puerto 5433
./mvnw spring-boot:run -Dspring-boot.run.profiles=demo     # API en el puerto 8080
./mvnw test
```

## Módulos

| Paquete | Módulo | Rutas bajo `/api` |
|---|---|---|
| `iam` | Identidad y Accesos | `auth/login`, `auth/me`, `usuarios`, `roles` |
| `rh` | Recursos Humanos | `areas`, `cargos`, `empleados`, `horarios`, `nominas` |
| `inventario` | Inventario y Producción | `materiales`, `productos`, `lista-materiales`, `movimientos`, `ordenes-produccion`, `consumos`, `unidades` |
| `compras` | Compras | `proveedores`, `ordenes-compra`, `cuentas-por-pagar` |
| `ventas` | Ventas (CRM) | `clientes`, `cotizaciones`, `pedidos`, `facturas` |

Las entidades y repositorios son privados de cada paquete. Los módulos se comunican por interfaces públicas:
`Existencias` (Compras y Ventas mueven stock), `UsuarioActual` (auditoría) y `ConsultaEmpleados`.

## Decisiones de diseño

- **Integridad:** cada operación es una transacción. Las filas de stock y de documentos se bloquean
  (`PESSIMISTIC_WRITE`) siempre en orden de id para evitar interbloqueos, y la base añade restricciones `CHECK`
  como última defensa.
- **Permisos:** el token solo identifica al usuario. Los permisos se leen de la base en cada petición, de modo que
  desactivar un usuario o cambiar un rol surte efecto de inmediato.
- **Errores:** respuestas RFC 9457. El campo `detail` contiene el mensaje para el usuario. Una regla de negocio
  incumplida responde 409.

## Configuración

| Variable | Descripción |
|---|---|
| `NOVAKEY_DB_URL`, `NOVAKEY_DB_USUARIO`, `NOVAKEY_DB_CLAVE` | Conexión a PostgreSQL |
| `NOVAKEY_JWT_SECRETO` | Firma de los tokens. Mínimo 32 bytes; sin él la API no arranca |
| `NOVAKEY_ADMIN_CLAVE` | Si no hay usuarios, crea `admin` con el rol Administrador TI en el primer arranque |

**Perfil `demo`:** carga datos ficticios, usuarios con contraseña conocida y `POST /api/demo/reiniciar`, que borra
los datos. Compose lo activa por defecto. Sin ese perfil, nada de esto existe. **No lo uses en producción.**

## Diferencias con el diagrama ER

- `orden_produccion.avance` (`INTEGER[]`) es nuevo: guarda las unidades que superaron cada una de las seis estaciones.
- Los id son `BIGINT` en lugar de `INT`.
- `numero_serie_seq` y `numero_factura_seq` son nuevas: garantizan numeración única con usuarios concurrentes.

## Supuestos por validar

- IVA del 19 %, deducción de nómina del 8 % sobre el salario base (simplificación, no liquidación legal) y crédito
  de proveedor a 30 días.
- El material se descuenta al iniciar la orden y el producto al confirmar el pedido.

## Pendiente antes de producción

- **RF06:** el pedido admite el canal `web`, pero no hay tienda ni endpoint para ella.
- **HTTPS:** Nginx solo escucha HTTP. El documento exige HTTPS.
- **Contraseñas:** no hay cambio ni recuperación de contraseña.
- **Inicio de sesión:** no limita los intentos fallidos.
- **100 usuarios concurrentes:** una prueba comprueba que 100 pedidos simultáneos no sobrevenden, pero eso valida la
  integridad, no la capacidad. Falta una prueba de carga en el servidor definitivo.
- **Trazabilidad:** `unidad_producida.id_detalle_pedido` existe, pero aún no se asigna al vender.
- **Volumen:** solo `movimientos` limita sus resultados; las demás listas no tienen paginación.
- **Copias de seguridad y CI:** el documento prevé copias con pruebas de restauración y GitHub Actions; no están.

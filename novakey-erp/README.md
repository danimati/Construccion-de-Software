# NovaKey ERP · Frontend en Angular

Interfaz del ERP descrito en *Esquema Empresa NovaKey* (Construcción de Software, grupo 020-81). Consume la API de
Spring Boot de `../novakey-api`, donde están las reglas de negocio, los permisos y los datos.

## Ejecutar

Requiere Node.js 22 y la API en marcha (consulta `../novakey-api/README.md`).

```bash
npm install
npm start        # http://localhost:4200, reenvía /api al puerto 8080
npm test -- --watch=false
npm run build    # dist/novakey-erp/browser
```

## Usuarios de demostración

Solo existen con el perfil `demo` de la API. La contraseña de todos es `novakey`, y la pantalla de acceso muestra
un botón por rol.

| Usuario | Rol | Ventas | Inventario | Producción | Compras | RR. HH. | Accesos |
|---|---|---|---|---|---|---|---|
| `mquintero` | Gerencia | Ver | Ver | Ver | Ver | Ver | Ver |
| `ecampos` | Comercial | Editar | Ver | – | – | – | – |
| `princon` | Producción | – | Editar | Editar | Ver | – | – |
| `jsalcedo` | Compras | – | Ver | – | Editar | – | – |
| `nmedina` | Recursos Humanos | – | – | – | – | Editar | – |
| `slinares` | Administrador TI | Ver | Ver | Ver | Ver | Ver | Editar |

El enlace **Restablecer datos de ejemplo** de la barra lateral borra los cambios en la base de demostración.

## Estructura

```
src/app/
  core/models.ts       Tipos de la API y constantes
  core/erp-store.ts    Cliente de la API y copia local de los datos
  layout/shell.ts      Barra lateral y avisos
  features/            Una pantalla por módulo, cargada bajo demanda
  shared/ui.ts         Pipes, etiqueta de estado, logo, modal y avisos
```

El menú oculta lo que un rol no puede usar, pero la protección real está en el servidor.

## Notas de configuración

- `.npmrc` fija `legacy-peer-deps=true`: sin esto, `npm install` falla con npm 10.9.7
  (`Cannot read properties of null (reading 'edgesOut')`).
- `angular.json` desactiva `optimization.fonts` en producción: el incrustado de Google Fonts fallaba de forma
  intermitente y dejaba `ng build` colgado. Las fuentes se siguen cargando en el navegador.
- El enrutado usa `#` (`/#/panel`) para poder servir la carpeta `dist` desde cualquier servidor estático.
- El token se guarda en `sessionStorage`: se pierde al cerrar la pestaña.

Lo pendiente y los supuestos por validar están en `../novakey-api/README.md`.

# NovaKey ERP · Frontend en React

Interfaz del ERP NovaKey, reescrita a **React + Vite + JavaScript** según el documento
`Esquema_NovaKey_Integrado_DevOps.pdf`. Reutiliza el sistema de diseño del frontend Angular
original (`../novakey-erp`): paleta azul marino, tipografía IBM Plex y los mismos componentes
(tarjetas, tablas, botones, etiquetas de estado, KPIs). Consume la API de FastAPI (`../novakey-api-py`).

Esta carpeta reemplazará a `../novakey-erp` una vez completada la reescritura.

## Estado

| Pieza | Estado |
|---|---|
| Proyecto Vite + React, sistema de diseño reutilizado | ✅ |
| Cliente de API, contexto de sesión y permisos, avisos (toasts) | ✅ |
| Pantalla de **Login** (con accesos demo por rol) | ✅ |
| **Shell** con barra lateral por permisos y **Panel general** | ✅ |
| Pantalla de **Inventario** (materiales y productos) | ✅ |
| Pantalla de **Compras** (proveedores, órdenes, cuentas por pagar) | ✅ |
| Pantalla de **Ventas** (cotizaciones, pedidos, facturas) | ✅ |
| Producción · RR. HH. · Accesos | ⏳ pantallas por reconstruir |

## Ejecutar

Requiere Node.js 22+ y la API en marcha (`../novakey-api-py`).

```bash
npm install
npm run dev        # http://localhost:4200, reenvía /api al puerto 8080
npm test -- --run
npm run build      # genera dist/
```

## Estructura

```
src/
  core/        api.js (cliente HTTP), sesion.jsx (auth + permisos), modulos.js, useRecurso.js
  shared/      ui.jsx (Logo, Estado, formateadores), avisos.jsx (toasts)
  layout/      Shell.jsx (barra lateral)
  features/    Login, Panel, Inventario y pantallas por módulo
  styles.css   Sistema de diseño (reutilizado del frontend Angular)
```

## Notas

- El enrutado usa `#` (`HashRouter`) para servir `dist/` desde cualquier servidor estático.
- El token se guarda en `sessionStorage`: se pierde al cerrar la pestaña.
- El menú oculta lo que un rol no puede usar, pero la protección real está en el servidor.

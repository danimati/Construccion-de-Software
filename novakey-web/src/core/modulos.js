// Módulos del ERP y las seis estaciones de la línea de producción.
// Equivale a MODULOS/ESTACIONES del modelo del frontend Angular.

export const MODULOS = [
  { id: 'ventas', etiqueta: 'Ventas (CRM)', codigo: 'VE', ruta: '/ventas' },
  { id: 'inventario', etiqueta: 'Inventario', codigo: 'IN', ruta: '/inventario' },
  { id: 'produccion', etiqueta: 'Producción', codigo: 'PR', ruta: '/produccion' },
  { id: 'compras', etiqueta: 'Compras', codigo: 'CO', ruta: '/compras' },
  { id: 'rh', etiqueta: 'Recursos Humanos', codigo: 'RH', ruta: '/recursos-humanos' },
  { id: 'accesos', etiqueta: 'Identidad y Accesos', codigo: 'IA', ruta: '/accesos' },
];

export const ESTACIONES = [
  'Almacén de componentes',
  'Ensamblaje de PCB',
  'Montaje del teclado',
  'Integración OLED',
  'Control de calidad',
  'Empaque y despacho',
];

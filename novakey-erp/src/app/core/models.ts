// Modelo de dominio derivado de NovaKey_ERP_entidad_relacion.drawio.
// Los detalles (detalle_orden_compra, detalle_pedido...) van embebidos en su documento.

export type Modulo = 'ventas' | 'inventario' | 'produccion' | 'compras' | 'rh' | 'accesos';
export type Nivel = 'ver' | 'editar';

// --- Identidad y Accesos ---
export interface Rol {
  id: number;
  nombre: string;
  descripcion: string;
  permisos: Record<Modulo, Nivel | null>;
}
export interface Sesion {
  id: number;
  username: string;
  nombre: string;
  roles: string[];
  permisos: Record<Modulo, Nivel | null>;
}
export interface Usuario {
  id: number;
  empleadoId: number | null;
  username: string;
  email: string;
  activo: boolean;
  rolIds: number[];
}

// --- Recursos Humanos ---
export interface Area {
  id: number;
  nombre: string;
}
export interface Cargo {
  id: number;
  areaId: number;
  nombre: string;
  salarioBase: number;
}
export type EstadoEmpleado = 'activo' | 'vacaciones' | 'retirado';
export interface Empleado {
  id: number;
  cargoId: number;
  documento: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string;
  fechaIngreso: string;
  estado: EstadoEmpleado;
}
export interface Horario {
  id: number;
  empleadoId: number;
  diaSemana: number; // 1 = lunes
  horaInicio: string;
  horaFin: string;
}
export interface DetalleNomina {
  id: number;
  empleadoId: number;
  salarioBase: number;
  devengados: number;
  deducciones: number;
  netoPagar: number;
}
export interface Nomina {
  id: number;
  periodoInicio: string;
  periodoFin: string;
  fechaPago: string;
  estado: 'borrador' | 'pagada';
  detalles: DetalleNomina[];
}

// --- Compras ---
export interface Proveedor {
  id: number;
  nit: string;
  razonSocial: string;
  contacto: string;
  email: string;
  telefono: string;
}
export interface DetalleOrdenCompra {
  id: number;
  materialId: number;
  cantidad: number;
  cantidadRecibida: number;
  precioUnitario: number;
}
export type EstadoOrdenCompra = 'enviada' | 'parcial' | 'recibida' | 'cancelada';
export interface OrdenCompra {
  id: number;
  proveedorId: number;
  usuarioId: number;
  fecha: string;
  estado: EstadoOrdenCompra;
  total: number;
  detalles: DetalleOrdenCompra[];
}
export interface CuentaPorPagar {
  id: number;
  ordenCompraId: number;
  monto: number;
  saldo: number;
  fechaVencimiento: string;
  estado: 'abierta' | 'pagada';
}

// --- Inventario y Producción ---
export interface Material {
  id: number;
  codigo: string;
  nombre: string;
  unidadMedida: string;
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
}
export interface Producto {
  id: number;
  sku: string;
  nombre: string;
  precioVenta: number;
  stockActual: number;
  activo: boolean;
}
export interface LineaMaterial {
  productoId: number;
  materialId: number;
  cantidad: number;
}
export type EstadoOrdenProduccion = 'planeada' | 'en_proceso' | 'terminada' | 'cancelada';
export interface OrdenProduccion {
  id: number;
  productoId: number;
  usuarioId: number;
  cantidad: number;
  fechaInicio: string | null;
  fechaFin: string | null;
  estado: EstadoOrdenProduccion;
  /** Unidades que superaron cada una de las seis estaciones de la línea. */
  avance: number[];
}
export interface ConsumoMaterial {
  id: number;
  ordenProduccionId: number;
  materialId: number;
  cantidad: number;
  fecha: string;
}
export interface UnidadProducida {
  id: number;
  ordenProduccionId: number;
  numeroSerie: string;
  resultadoCalidad: 'aprobada' | 'rechazada';
  fechaEnsamblaje: string;
}
export type TipoMovimiento =
  | 'entrada_compra'
  | 'salida_produccion'
  | 'entrada_produccion'
  | 'salida_venta'
  | 'devolucion_venta'
  | 'ajuste';
export interface MovimientoInventario {
  id: number;
  materialId: number | null;
  productoId: number | null;
  usuarioId: number;
  usuario: string;
  tipo: TipoMovimiento;
  cantidad: number;
  documentoRef: string;
  fecha: string;
}

// --- Ventas ---
export interface Cliente {
  id: number;
  tipo: 'corp' | 'final';
  documento: string;
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
}
export interface LineaVenta {
  id: number;
  productoId: number;
  cantidad: number;
  precioUnitario: number;
}
export type EstadoCotizacion = 'enviada' | 'aceptada' | 'rechazada';
export interface Cotizacion {
  id: number;
  clienteId: number;
  usuarioId: number;
  fecha: string;
  vigencia: string;
  estado: EstadoCotizacion;
  total: number;
  detalles: LineaVenta[];
}
export type EstadoPedido = 'confirmado' | 'en_preparacion' | 'facturado' | 'cancelado';
export interface Pedido {
  id: number;
  clienteId: number;
  cotizacionId: number | null;
  canal: 'directo' | 'web';
  fecha: string;
  estado: EstadoPedido;
  detalles: LineaVenta[];
}
export interface Factura {
  id: number;
  pedidoId: number;
  numero: string;
  fecha: string;
  subtotal: number;
  impuestos: number;
  total: number;
  estado: 'emitida' | 'pagada';
}

export interface ErpState {
  roles: Rol[];
  usuarios: Usuario[];
  areas: Area[];
  cargos: Cargo[];
  empleados: Empleado[];
  horarios: Horario[];
  nominas: Nomina[];
  proveedores: Proveedor[];
  ordenesCompra: OrdenCompra[];
  cuentasPorPagar: CuentaPorPagar[];
  materiales: Material[];
  productos: Producto[];
  listaMateriales: LineaMaterial[];
  ordenesProduccion: OrdenProduccion[];
  consumos: ConsumoMaterial[];
  unidades: UnidadProducida[];
  movimientos: MovimientoInventario[];
  clientes: Cliente[];
  cotizaciones: Cotizacion[];
  pedidos: Pedido[];
  facturas: Factura[];
}

/** Las seis estaciones de la línea del segundo piso (sección 13 del documento). */
export const ESTACIONES = [
  'Almacén de componentes',
  'Ensamblaje de PCB',
  'Montaje del teclado',
  'Integración OLED',
  'Control de calidad',
  'Empaque y despacho',
] as const;
export const ESTACION_CALIDAD = 4;
export const ESTACION_EMPAQUE = 5;

export const MODULOS: { id: Modulo; etiqueta: string; codigo: string; ruta: string }[] = [
  { id: 'ventas', etiqueta: 'Ventas (CRM)', codigo: 'VE', ruta: '/ventas' },
  { id: 'inventario', etiqueta: 'Inventario', codigo: 'IN', ruta: '/inventario' },
  { id: 'produccion', etiqueta: 'Producción', codigo: 'PR', ruta: '/produccion' },
  { id: 'compras', etiqueta: 'Compras', codigo: 'CO', ruta: '/compras' },
  { id: 'rh', etiqueta: 'Recursos Humanos', codigo: 'RH', ruta: '/recursos-humanos' },
  { id: 'accesos', etiqueta: 'Identidad y Accesos', codigo: 'IA', ruta: '/accesos' },
];

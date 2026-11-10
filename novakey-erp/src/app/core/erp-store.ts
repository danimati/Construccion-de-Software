import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Empleado,
  ErpState,
  ESTACIONES,
  ESTACION_CALIDAD,
  ESTACION_EMPAQUE,
  Modulo,
  Nivel,
  Sesion,
} from './models';

const CLAVE_TOKEN = 'novakey-erp.token.v1';
const API = '/api';

export const ROL_ADMIN_ID = 6;

export type LineaNueva = { productoId: number; cantidad: number; precioUnitario: number };
export type LineaCompraNueva = { materialId: number; cantidad: number; precioUnitario: number };
export type AccesoDemo = { username: string; rol: string; password: string };

const pad = (n: number, largo = 4) => String(n).padStart(largo, '0');
export const codigoDoc = (prefijo: string, id: number) => `${prefijo}-${pad(id)}`;

export function fechaLocal(fecha = new Date()): string {
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1, 2)}-${pad(fecha.getDate(), 2)}`;
}

export const totalLineas = (lineas: { cantidad: number; precioUnitario: number }[]) =>
  lineas.reduce((t, l) => t + l.cantidad * l.precioUnitario, 0);

function leerToken(): string | null {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}
function guardarToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(CLAVE_TOKEN, token);
    else sessionStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin almacenamiento la sesión dura hasta recargar la página.
  }
}

const ESTADO_VACIO: ErpState = {
  roles: [], usuarios: [], areas: [], cargos: [], empleados: [], horarios: [], nominas: [],
  proveedores: [], ordenesCompra: [], cuentasPorPagar: [],
  materiales: [], productos: [], listaMateriales: [], ordenesProduccion: [], consumos: [], unidades: [], movimientos: [],
  clientes: [], cotizaciones: [], pedidos: [], facturas: [],
};

/** De dónde sale cada lista y qué módulos dan derecho a pedirla. Coincide con los permisos del servidor. */
const FUENTES: Record<keyof ErpState, { url: string; modulos: Modulo[] }> = {
  roles: { url: '/roles', modulos: ['accesos'] },
  usuarios: { url: '/usuarios', modulos: ['accesos'] },
  areas: { url: '/areas', modulos: ['rh'] },
  cargos: { url: '/cargos', modulos: ['rh'] },
  empleados: { url: '/empleados', modulos: ['rh'] },
  horarios: { url: '/horarios', modulos: ['rh'] },
  nominas: { url: '/nominas', modulos: ['rh'] },
  proveedores: { url: '/proveedores', modulos: ['compras'] },
  ordenesCompra: { url: '/ordenes-compra', modulos: ['compras'] },
  cuentasPorPagar: { url: '/cuentas-por-pagar', modulos: ['compras'] },
  materiales: { url: '/materiales', modulos: ['inventario', 'produccion', 'compras'] },
  productos: { url: '/productos', modulos: ['inventario', 'produccion', 'ventas'] },
  listaMateriales: { url: '/lista-materiales', modulos: ['inventario', 'produccion'] },
  ordenesProduccion: { url: '/ordenes-produccion', modulos: ['produccion'] },
  consumos: { url: '/consumos', modulos: ['produccion'] },
  unidades: { url: '/unidades', modulos: ['produccion'] },
  movimientos: { url: '/movimientos', modulos: ['inventario'] },
  clientes: { url: '/clientes', modulos: ['ventas'] },
  cotizaciones: { url: '/cotizaciones', modulos: ['ventas'] },
  pedidos: { url: '/pedidos', modulos: ['ventas'] },
  facturas: { url: '/facturas', modulos: ['ventas'] },
};
const TODAS = Object.keys(FUENTES) as (keyof ErpState)[];

/** Añade el token a las peticiones. Las respuestas 401 las atiende Avisos.intentar. */
export const interceptorApi: HttpInterceptorFn = (peticion, siguiente) => {
  const token = inject(TokenSesion).valor();
  return siguiente(token ? peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : peticion);
};

@Injectable({ providedIn: 'root' })
export class TokenSesion {
  readonly valor = signal<string | null>(leerToken());

  fijar(token: string | null): void {
    this.valor.set(token);
    guardarToken(token);
  }
}

/**
 * Cliente de la API de Spring Boot y copia local de los datos que cada pantalla necesita.
 * Las reglas de negocio y los permisos se aplican en el servidor: aquí solo se muestran.
 */
@Injectable({ providedIn: 'root' })
export class ErpStore {
  private readonly http = inject(HttpClient);
  private readonly token = inject(TokenSesion);

  private readonly estado = signal<ErpState>(ESTADO_VACIO);
  readonly s = this.estado.asReadonly();

  readonly sesion = signal<Sesion | null>(null);
  readonly usuarioActual = this.sesion.asReadonly();
  readonly usuarioActualId = computed(() => this.sesion()?.id ?? null);
  /** Accesos de demostración. Solo existen si el servidor corre con el perfil demo. */
  readonly accesosDemo = signal<AccesoDemo[]>([]);

  readonly materialesBajoMinimo = computed(() =>
    this.s().materiales.filter((m) => m.stockActual < m.stockMinimo),
  );
  readonly pedidosAbiertos = computed(() =>
    this.s().pedidos.filter((p) => p.estado === 'confirmado' || p.estado === 'en_preparacion'),
  );
  readonly ordenesEnProceso = computed(() =>
    this.s().ordenesProduccion.filter((o) => o.estado === 'en_proceso'),
  );
  readonly cuentasAbiertas = computed(() =>
    this.s().cuentasPorPagar.filter((c) => c.estado === 'abierta'),
  );
  /** Unidades que esperan en cada estación, sumando las órdenes en proceso. */
  readonly unidadesPorEstacion = computed(() =>
    ESTACIONES.map((_, i) =>
      this.ordenesEnProceso().reduce((total, o) => total + this.unidadesEnEstacion(o.id, i), 0),
    ),
  );

  private get<T>(ruta: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(API + ruta));
  }
  private post<T>(ruta: string, cuerpo: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(API + ruta, cuerpo));
  }
  private put<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(API + ruta, cuerpo));
  }

  /** Vuelve a pedir las listas indicadas que el rol actual tiene derecho a ver. */
  private async refrescar(...claves: (keyof ErpState)[]): Promise<void> {
    const parcial: Partial<Record<keyof ErpState, unknown>> = {};
    await Promise.all(
      claves
        .filter((c) => this.tieneAcceso(c))
        .map(async (c) => {
          parcial[c] = await this.get(this.urlDe(c));
        }),
    );
    this.estado.update((actual) => ({ ...actual, ...(parcial as Partial<ErpState>) }));
  }

  private tieneAcceso(clave: keyof ErpState): boolean {
    if (clave === 'empleados') return this.puede('rh') || this.puede('accesos');
    return FUENTES[clave].modulos.some((m) => this.puede(m));
  }
  private urlDe(clave: keyof ErpState): string {
    // Quien administra accesos sin ser de RR. HH. solo recibe los nombres de los empleados.
    return clave === 'empleados' && !this.puede('rh') ? '/empleados/resumen' : FUENTES[clave].url;
  }

  // ---------- Sesión ----------

  /** Al abrir la aplicación: recupera la sesión guardada, si sigue siendo válida. */
  async restaurarSesion(): Promise<void> {
    await this.cargarAccesosDemo();
    if (!this.token.valor()) return;
    try {
      this.sesion.set(await this.get<Sesion>('/auth/me'));
      await this.refrescar(...TODAS);
    } catch {
      this.limpiarSesion();
    }
  }

  async cargarAccesosDemo(): Promise<void> {
    try {
      this.accesosDemo.set(await this.get<AccesoDemo[]>('/demo/accesos'));
    } catch {
      this.accesosDemo.set([]);
    }
  }

  async iniciarSesion(username: string, password: string): Promise<void> {
    const r = await this.post<{ token: string; usuario: Sesion }>('/auth/login', { username, password });
    this.token.fijar(r.token);
    this.sesion.set(r.usuario);
    await this.refrescar(...TODAS);
  }

  limpiarSesion(): void {
    this.token.fijar(null);
    this.sesion.set(null);
    this.estado.set(ESTADO_VACIO);
  }
  cerrarSesion(): void {
    this.limpiarSesion();
  }

  puede(modulo: Modulo, nivel: Nivel = 'ver'): boolean {
    const otorgado = this.sesion()?.permisos[modulo];
    return nivel === 'ver' ? !!otorgado : otorgado === 'editar';
  }

  async restablecerDatos(): Promise<void> {
    await this.post('/demo/reiniciar');
    await this.refrescar(...TODAS);
  }

  // ---------- Inventario ----------

  async registrarAjuste(ref: { materialId?: number; productoId?: number }, cantidad: number | null, motivo: string): Promise<void> {
    await this.post('/movimientos/ajustes', { ...ref, cantidad, motivo });
    await this.refrescar('materiales', 'productos', 'movimientos');
  }

  /** Unidades fabricables con las existencias actuales y qué material limita. */
  capacidadFabricacion(productoId: number): { unidades: number; limitante: string | null } {
    const { listaMateriales, materiales } = this.s();
    let unidades = Infinity;
    let limitante: string | null = null;
    for (const linea of listaMateriales.filter((l) => l.productoId === productoId)) {
      const material = materiales.find((m) => m.id === linea.materialId);
      if (!material) continue;
      const posibles = Math.floor(material.stockActual / linea.cantidad);
      if (posibles < unidades) {
        unidades = posibles;
        limitante = material.nombre;
      }
    }
    return { unidades: unidades === Infinity ? 0 : unidades, limitante };
  }

  // ---------- Producción ----------

  async crearOrdenProduccion(productoId: number, cantidad: number | null): Promise<number> {
    const o = await this.post<{ id: number }>('/ordenes-produccion', { productoId, cantidad });
    await this.refrescar('ordenesProduccion');
    return o.id;
  }
  async iniciarOrdenProduccion(id: number): Promise<void> {
    await this.post(`/ordenes-produccion/${id}/iniciar`);
    await this.refrescar('ordenesProduccion', 'materiales', 'consumos', 'movimientos');
  }
  async cancelarOrdenProduccion(id: number): Promise<void> {
    await this.post(`/ordenes-produccion/${id}/cancelar`);
    await this.refrescar('ordenesProduccion');
  }
  async registrarAvance(ordenId: number, estacion: number, resultado?: 'aprobada' | 'rechazada'): Promise<void> {
    await this.post(`/ordenes-produccion/${ordenId}/avance`, { estacion, resultado });
    await this.refrescar('ordenesProduccion', 'unidades', 'productos', 'movimientos');
  }

  aprobadas(ordenId: number): number {
    return this.s().unidades.filter((u) => u.ordenProduccionId === ordenId && u.resultadoCalidad === 'aprobada').length;
  }
  /** Máximo que puede avanzar una estación según lo que superó la anterior. El servidor lo vuelve a comprobar. */
  limiteEstacion(ordenId: number, estacion: number): number {
    const orden = this.s().ordenesProduccion.find((o) => o.id === ordenId);
    if (!orden || estacion === 0) return orden?.cantidad ?? 0;
    return estacion === ESTACION_EMPAQUE ? this.aprobadas(ordenId) : orden.avance[estacion - 1];
  }
  unidadesEnEstacion(ordenId: number, estacion: number): number {
    const orden = this.s().ordenesProduccion.find((o) => o.id === ordenId);
    if (!orden) return 0;
    if (estacion === ESTACION_EMPAQUE) return orden.avance[estacion];
    if (estacion === ESTACION_CALIDAD) return this.aprobadas(ordenId) - orden.avance[ESTACION_EMPAQUE];
    return orden.avance[estacion] - orden.avance[estacion + 1];
  }

  // ---------- Compras ----------

  async crearProveedor(p: { nit: string; razonSocial: string; contacto: string; email: string; telefono: string }): Promise<void> {
    await this.post('/proveedores', p);
    await this.refrescar('proveedores');
  }
  async crearOrdenCompra(proveedorId: number, lineas: LineaCompraNueva[]): Promise<number> {
    const o = await this.post<{ id: number }>('/ordenes-compra', { proveedorId, lineas });
    await this.refrescar('ordenesCompra');
    return o.id;
  }
  async registrarRecepcion(ordenId: number, cantidades: Record<number, number>): Promise<void> {
    await this.post(`/ordenes-compra/${ordenId}/recepciones`, { cantidades });
    await this.refrescar('ordenesCompra', 'cuentasPorPagar', 'materiales', 'movimientos');
  }
  async registrarPago(cuentaId: number, monto: number | null): Promise<void> {
    await this.post(`/cuentas-por-pagar/${cuentaId}/pagos`, { monto });
    await this.refrescar('cuentasPorPagar');
  }

  // ---------- Ventas ----------

  async crearCliente(c: { tipo: 'corp' | 'final'; documento: string; nombre: string; email: string; telefono: string; direccion: string }): Promise<void> {
    await this.post('/clientes', c);
    await this.refrescar('clientes');
  }
  async crearCotizacion(clienteId: number, lineas: LineaNueva[], vigencia: string): Promise<number> {
    const c = await this.post<{ id: number }>('/cotizaciones', { clienteId, lineas, vigencia: vigencia || null });
    await this.refrescar('cotizaciones');
    return c.id;
  }
  async rechazarCotizacion(id: number): Promise<void> {
    await this.post(`/cotizaciones/${id}/rechazar`);
    await this.refrescar('cotizaciones');
  }
  async crearPedido(clienteId: number, lineas: LineaNueva[]): Promise<number> {
    const p = await this.post<{ id: number }>('/pedidos', { clienteId, lineas });
    await this.refrescar('pedidos', 'productos', 'movimientos');
    return p.id;
  }
  async convertirEnPedido(cotizacionId: number): Promise<number> {
    const p = await this.post<{ id: number }>(`/cotizaciones/${cotizacionId}/pedido`);
    await this.refrescar('cotizaciones', 'pedidos', 'productos', 'movimientos');
    return p.id;
  }
  async prepararPedido(id: number): Promise<void> {
    await this.post(`/pedidos/${id}/preparar`);
    await this.refrescar('pedidos');
  }
  async cancelarPedido(id: number): Promise<void> {
    await this.post(`/pedidos/${id}/cancelar`);
    await this.refrescar('pedidos', 'productos', 'movimientos');
  }
  async facturarPedido(id: number): Promise<string> {
    const f = await this.post<{ numero: string }>(`/pedidos/${id}/factura`);
    await this.refrescar('pedidos', 'facturas');
    return f.numero;
  }
  async marcarFacturaPagada(id: number): Promise<void> {
    await this.post(`/facturas/${id}/pagada`);
    await this.refrescar('facturas');
  }

  // ---------- Recursos Humanos ----------

  async crearEmpleado(e: Omit<Empleado, 'id' | 'estado'>, horaInicio: string, horaFin: string): Promise<void> {
    await this.post('/empleados', { ...e, fechaIngreso: e.fechaIngreso || null, horaInicio: horaInicio || null, horaFin: horaFin || null });
    await this.refrescar('empleados', 'horarios');
  }
  async cambiarEstadoEmpleado(id: number, estado: Empleado['estado']): Promise<void> {
    await this.put(`/empleados/${id}/estado`, { estado });
    await this.refrescar('empleados');
  }
  /** Mes siguiente al último periodo liquidado, solo para rotular el botón; lo calcula el servidor. */
  siguientePeriodo(): { inicio: string; fin: string } {
    const ultimo = this.s().nominas.map((n) => n.periodoFin).sort().at(-1);
    const base = ultimo ? new Date(`${ultimo}T12:00:00`) : new Date();
    const inicio = new Date(base.getFullYear(), base.getMonth() + (ultimo ? 1 : 0), 1);
    const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0);
    return { inicio: fechaLocal(inicio), fin: fechaLocal(fin) };
  }
  async generarNomina(): Promise<void> {
    await this.post('/nominas');
    await this.refrescar('nominas');
  }
  async actualizarDevengados(nominaId: number, detalleId: number, devengados: number): Promise<void> {
    await this.put(`/nominas/${nominaId}/detalles/${detalleId}/devengados`, { devengados });
    await this.refrescar('nominas');
  }
  async pagarNomina(id: number): Promise<void> {
    await this.post(`/nominas/${id}/pagar`);
    await this.refrescar('nominas');
  }

  // ---------- Identidad y Accesos ----------

  async crearUsuario(u: { username: string; email: string; password: string; empleadoId: number | null; rolId: number }): Promise<void> {
    await this.post('/usuarios', u);
    await this.refrescar('usuarios');
  }
  async cambiarRolUsuario(id: number, rolId: number): Promise<void> {
    await this.put(`/usuarios/${id}/rol`, { rolId });
    await this.refrescar('usuarios');
  }
  async fijarActivoUsuario(id: number, activo: boolean): Promise<void> {
    await this.put(`/usuarios/${id}/activo`, { activo });
    await this.refrescar('usuarios');
  }
  async fijarPermiso(rolId: number, modulo: Modulo, nivel: Nivel | null): Promise<void> {
    await this.put(`/roles/${rolId}/permisos/${modulo}`, { nivel });
    await this.refrescar('roles');
  }
}

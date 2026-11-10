import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ErpStore, interceptorApi } from './erp-store';
import { Sesion } from './models';

// Las reglas de negocio se prueban en el backend; aquí, el contrato con la API.
const sesionComercial: Sesion = {
  id: 2,
  username: 'ecampos',
  nombre: 'Elena Campos',
  roles: ['Comercial'],
  permisos: { ventas: 'editar', inventario: 'ver', produccion: null, compras: null, rh: null, accesos: null },
};

describe('ErpStore', () => {
  let store: ErpStore;
  let http: HttpTestingController;

  const responderListas = async () => {
    await Promise.resolve();
    const pendientes = http.match(() => true);
    pendientes.forEach((p) => p.flush([]));
    await new Promise((r) => setTimeout(r));
    return pendientes.map((p) => p.request);
  };

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([interceptorApi])), provideHttpClientTesting()],
    });
    store = TestBed.inject(ErpStore);
    http = TestBed.inject(HttpTestingController);
  });

  const entrar = async () => {
    const promesa = store.iniciarSesion('ecampos', 'novakey');
    http.expectOne('/api/auth/login').flush({ token: 'tok-1', usuario: sesionComercial });
    await new Promise((r) => setTimeout(r));
    const peticiones = await responderListas();
    await promesa;
    return peticiones;
  };

  it('solo pide las listas que el rol puede ver y envía el token', async () => {
    const peticiones = await entrar();
    const urls = peticiones.map((p) => p.url);
    expect(urls).toContain('/api/clientes');
    expect(urls).toContain('/api/materiales');
    expect(urls).not.toContain('/api/nominas');
    expect(urls).not.toContain('/api/usuarios');
    expect(peticiones.every((p) => p.headers.get('Authorization') === 'Bearer tok-1')).toBe(true);
  });

  it('aplica los niveles de permiso de la sesión', async () => {
    await entrar();
    expect(store.puede('ventas', 'editar')).toBe(true);
    expect(store.puede('inventario')).toBe(true);
    expect(store.puede('inventario', 'editar')).toBe(false);
    expect(store.puede('rh')).toBe(false);
  });

  it('cerrar sesión borra el token y los datos', async () => {
    await entrar();
    store.cerrarSesion();
    expect(store.usuarioActual()).toBeNull();
    expect(sessionStorage.getItem('novakey-erp.token.v1')).toBeNull();
    expect(store.s().clientes).toEqual([]);
  });

  it('una operación envía los datos y refresca lo afectado', async () => {
    await entrar();
    const promesa = store.convertirEnPedido(2);
    http.expectOne({ method: 'POST', url: '/api/cotizaciones/2/pedido' }).flush({ id: 9 });
    await new Promise((r) => setTimeout(r));
    const urls = (await responderListas()).map((p) => p.url);
    expect(await promesa).toBe(9);
    expect(urls).toEqual(expect.arrayContaining(['/api/cotizaciones', '/api/pedidos', '/api/productos', '/api/movimientos']));
  });
});

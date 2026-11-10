import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ErpStore, totalLineas } from '../core/erp-store';
import { ESTACIONES } from '../core/models';
import { CopPipe, DocPipe, Estado, NumPipe } from '../shared/ui';

@Component({
  selector: 'nk-panel',
  imports: [RouterLink, CopPipe, DocPipe, NumPipe, Estado],
  template: `
    <div class="pagina">
      <header class="cab">
        <div>
          <h1>Panel general</h1>
          <p>Estado de abastecimiento, producción y ventas</p>
        </div>
        <span class="estado alerta">Datos de ejemplo</span>
      </header>

      <section class="kpis" aria-label="Indicadores">
        @if (store.puede('ventas')) {
          <a class="kpi" routerLink="/ventas">
            <span class="kpi-etq">Pedidos por despachar</span>
            <span class="kpi-valor">{{ store.pedidosAbiertos().length }}</span>
            <span class="kpi-nota">{{ valorPedidos() | cop }} en pedidos</span>
          </a>
        }
        @if (store.puede('produccion')) {
          <a class="kpi" routerLink="/produccion">
            <span class="kpi-etq">Órdenes en producción</span>
            <span class="kpi-valor">{{ store.ordenesEnProceso().length }}</span>
            <span class="kpi-nota">{{ unidadesPlaneadas() }} unidades planeadas</span>
          </a>
        }
        @if (store.puede('inventario')) {
          <a class="kpi" routerLink="/inventario">
            <span class="kpi-etq">Materiales bajo mínimo</span>
            <span class="kpi-valor">{{ store.materialesBajoMinimo().length }}</span>
            <span class="kpi-nota">de {{ store.s().materiales.length }} materiales activos</span>
          </a>
        }
        @if (store.puede('compras')) {
          <a class="kpi" routerLink="/compras">
            <span class="kpi-etq">Cuentas por pagar</span>
            <span class="kpi-valor">{{ saldoPorPagar() | cop: 'corto' }}</span>
            <span class="kpi-nota">{{ store.cuentasAbiertas().length }} facturas abiertas</span>
          </a>
        }
        @if (store.puede('rh')) {
          <a class="kpi" routerLink="/recursos-humanos">
            <span class="kpi-etq">Personal activo</span>
            <span class="kpi-valor">{{ personalActivo() }}</span>
            <span class="kpi-nota">de {{ store.s().empleados.length }} empleados</span>
          </a>
        }
      </section>

      @if (store.puede('produccion')) {
        <section class="tarjeta" aria-labelledby="linea">
          <div class="tarjeta-cab">
            <h2 id="linea">Línea de fabricación · segundo piso</h2>
            <a routerLink="/produccion">Ver órdenes</a>
          </div>
          <ol class="estaciones">
            @for (nombre of estaciones; track nombre; let i = $index) {
              <li class="estacion">
                <span class="mono suave">Estación {{ i + 1 }}</span>
                <span class="estacion-nombre">{{ nombre }}</span>
                <span class="estacion-valor">{{ store.unidadesPorEstacion()[i] }} <small class="suave chico">und</small></span>
              </li>
            }
          </ol>
        </section>
      }

      <div class="columnas">
        @if (store.puede('inventario')) {
          <section class="tarjeta" aria-labelledby="alertas">
            <h2 id="alertas">Materiales bajo mínimo</h2>
            @if (store.materialesBajoMinimo().length) {
              <div class="tabla-caja">
                <table>
                  <thead><tr><th>Material</th><th class="der">Stock</th><th class="der">Mínimo</th>
                    @if (store.puede('compras', 'editar')) { <th><span class="sr">Acción</span></th> }
                  </tr></thead>
                  <tbody>
                    @for (m of store.materialesBajoMinimo(); track m.id) {
                      <tr>
                        <td>{{ m.nombre }}</td>
                        <td class="der alerta-txt">{{ m.stockActual | num }}</td>
                        <td class="der">{{ m.stockMinimo | num }}</td>
                        @if (store.puede('compras', 'editar')) {
                          <td class="der"><a routerLink="/compras">Crear orden</a></td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="vacio">Todos los materiales están sobre su mínimo.</p>
            }
          </section>
        }
        @if (store.puede('ventas')) {
          <section class="tarjeta" aria-labelledby="pedidos">
            <h2 id="pedidos">Pedidos recientes</h2>
            <div class="tabla-caja">
              <table>
                <thead><tr><th>Pedido</th><th>Cliente</th><th>Estado</th></tr></thead>
                <tbody>
                  @for (p of pedidosRecientes(); track p.id) {
                    <tr>
                      <td class="mono">{{ p.id | doc: 'PED' }}</td>
                      <td>{{ cliente(p.clienteId) }}</td>
                      <td><nk-estado [valor]="p.estado" /></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
      </div>
    </div>
  `,
})
export class Panel {
  protected readonly store = inject(ErpStore);
  protected readonly estaciones = ESTACIONES;

  protected readonly valorPedidos = computed(() =>
    this.store.pedidosAbiertos().reduce((t, p) => t + totalLineas(p.detalles), 0),
  );
  protected readonly unidadesPlaneadas = computed(() =>
    this.store.ordenesEnProceso().reduce((t, o) => t + o.cantidad, 0),
  );
  protected readonly saldoPorPagar = computed(() =>
    this.store.cuentasAbiertas().reduce((t, c) => t + c.saldo, 0),
  );
  protected readonly personalActivo = computed(
    () => this.store.s().empleados.filter((e) => e.estado === 'activo').length,
  );
  protected readonly pedidosRecientes = computed(() =>
    [...this.store.s().pedidos].sort((a, b) => b.id - a.id).slice(0, 5),
  );

  protected cliente(id: number): string {
    return this.store.s().clientes.find((c) => c.id === id)?.nombre ?? '—';
  }
}

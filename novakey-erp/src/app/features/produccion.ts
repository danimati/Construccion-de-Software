import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ErpStore, codigoDoc } from '../core/erp-store';
import { ESTACIONES, ESTACION_CALIDAD, OrdenProduccion } from '../core/models';
import { Avisos, DocPipe, Estado, Modal, NumPipe } from '../shared/ui';

@Component({
  selector: 'nk-produccion',
  imports: [FormsModule, DatePipe, DocPipe, NumPipe, Estado, Modal],
  template: `
    <div class="pagina">
      <header class="cab">
        <div>
          <h1>Producción</h1>
          <p>Órdenes de ensamblaje, consumo de materiales y trazabilidad por unidad</p>
        </div>
        @if (puedeEditar()) {
          <button type="button" class="btn btn-pri" (click)="nuevaAbierta.set(true)">Nueva orden</button>
        }
      </header>

      <section class="tarjeta tabla-caja" aria-labelledby="ordenes">
        <h2 id="ordenes">Órdenes de producción</h2>
        <table>
          <thead><tr><th>Orden</th><th>Producto</th><th class="der">Cantidad</th><th>Inicio</th><th>Estado</th><th><span class="sr">Acciones</span></th></tr></thead>
          <tbody>
            @for (o of ordenes(); track o.id) {
              <tr [class.fila-sel]="o.id === seleccion()?.id">
                <td class="mono">{{ o.id | doc: 'OP' }}</td>
                <td>{{ producto(o.productoId) }}</td>
                <td class="der fuerte">{{ o.cantidad | num }}</td>
                <td>{{ o.fechaInicio ? (o.fechaInicio + 'T12:00:00' | date: 'd MMM y') : '—' }}</td>
                <td><nk-estado [valor]="o.estado" /></td>
                <td class="der">
                  <span class="grupo-btn">
                    @if (o.estado === 'planeada' && puedeEditar()) {
                      <button type="button" class="btn btn-chico btn-pri" (click)="iniciar(o.id)">Iniciar</button>
                      <button type="button" class="btn btn-chico" (click)="cancelar(o.id)">Cancelar</button>
                    }
                    <button type="button" class="btn btn-chico" (click)="seleccionId.set(o.id)">Ver detalle</button>
                  </span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </section>

      @if (seleccion(); as o) {
        <section class="tarjeta" aria-labelledby="recorrido">
          <h2 id="recorrido">{{ o.id | doc: 'OP' }} · recorrido en la línea</h2>
          <p class="chico suave" style="margin-bottom: 14px">Unidades que han superado cada estación, de {{ o.cantidad }} planeadas</p>
          <ol class="estaciones">
            @for (nombre of estaciones; track nombre; let i = $index) {
              <li style="display: flex; flex-direction: column; gap: 6px" class="chico">
                <span class="fuerte" style="min-height: 34px">{{ i + 1 }}. {{ nombre }}</span>
                <span class="barra" aria-hidden="true"><span [style.width.%]="(o.avance[i] / o.cantidad) * 100"></span></span>
                <span class="suave">{{ o.avance[i] }} de {{ i === 5 ? store.aprobadas(o.id) + ' aprobadas' : o.cantidad }}</span>
                @if (o.estado === 'en_proceso' && puedeEditar() && i > 0) {
                  @if (i === calidad) {
                    <span class="grupo-btn" style="justify-content: flex-start">
                      <button type="button" class="btn btn-chico" [disabled]="!pendiente(o.id, i)" (click)="avanzar(o.id, i, 'aprobada')">Aprobar</button>
                      <button type="button" class="btn btn-chico" [disabled]="!pendiente(o.id, i)" (click)="avanzar(o.id, i, 'rechazada')">Rechazar</button>
                    </span>
                  } @else {
                    <button type="button" class="btn btn-chico" [disabled]="!pendiente(o.id, i)" (click)="avanzar(o.id, i)" [attr.aria-label]="'Registrar una unidad en ' + nombre">+1 unidad</button>
                  }
                }
              </li>
            }
          </ol>
        </section>

        <div class="columnas">
          <section class="tarjeta" aria-labelledby="consumo">
            <h2 id="consumo">Consumo registrado</h2>
            @if (consumos().length) {
              <ul class="lista">
                @for (c of consumos(); track c.id) {
                  <li><span>{{ material(c.materialId) }}</span><span class="fuerte">{{ c.cantidad | num }}</span></li>
                }
              </ul>
            } @else {
              <p class="vacio">Sin consumos: el material se descuenta al iniciar la orden.</p>
            }
          </section>
          <section class="tarjeta tabla-caja" aria-labelledby="unidades">
            <h2 id="unidades">Unidades producidas</h2>
            @if (unidades().length) {
              <table>
                <thead><tr><th>Número de serie</th><th>Ensamblaje</th><th>Calidad</th></tr></thead>
                <tbody>
                  @for (u of unidades(); track u.id) {
                    <tr>
                      <td class="mono">{{ u.numeroSerie }}</td>
                      <td>{{ u.fechaEnsamblaje | date: 'd MMM y' }}</td>
                      <td><nk-estado [valor]="u.resultadoCalidad" /></td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="vacio">Sin unidades registradas en esta demostración: se asignan en control de calidad.</p>
            }
          </section>
        </div>
      }
    </div>

    <nk-modal titulo="Nueva orden de producción" [abierto]="nuevaAbierta()" (cerrado)="nuevaAbierta.set(false)">
      <form class="form" (ngSubmit)="crear()">
        <label class="campo">Producto
          <select name="producto" [ngModel]="productoNuevo()" (ngModelChange)="productoNuevo.set($event)">
            @for (p of store.s().productos; track p.id) { <option [ngValue]="p.id">{{ p.nombre }}</option> }
          </select>
        </label>
        <label class="campo">Cantidad
          <input name="cantidad" type="number" min="1" step="1" [(ngModel)]="cantidadNueva" />
        </label>
        <p class="chico suave">
          Con el stock actual se pueden fabricar {{ capacidadNueva().unidades | num }} unidades. Limita: {{ capacidadNueva().limitante }}.
        </p>
        <div class="form-pie"><span></span><button type="submit" class="btn btn-pri">Crear orden</button></div>
      </form>
    </nk-modal>
  `,
})
export class Produccion {
  protected readonly store = inject(ErpStore);
  private readonly avisos = inject(Avisos);

  protected readonly estaciones = ESTACIONES;
  protected readonly calidad = ESTACION_CALIDAD;
  protected readonly puedeEditar = computed(() => this.store.puede('produccion', 'editar'));
  protected readonly ordenes = computed(() => [...this.store.s().ordenesProduccion].sort((a, b) => b.id - a.id));

  protected readonly seleccionId = signal<number | null>(null);
  protected readonly seleccion = computed<OrdenProduccion | null>(() => {
    const id = this.seleccionId();
    const lista = this.ordenes();
    return lista.find((o) => o.id === id) ?? lista.find((o) => o.estado === 'en_proceso') ?? lista[0] ?? null;
  });
  protected readonly consumos = computed(() =>
    this.store.s().consumos.filter((c) => c.ordenProduccionId === this.seleccion()?.id),
  );
  protected readonly unidades = computed(() =>
    this.store.s().unidades.filter((u) => u.ordenProduccionId === this.seleccion()?.id).sort((a, b) => b.id - a.id),
  );

  protected readonly nuevaAbierta = signal(false);
  protected readonly productoNuevo = signal(1);
  protected readonly cantidadNueva = signal<number | null>(10);
  protected readonly capacidadNueva = computed(() => this.store.capacidadFabricacion(this.productoNuevo()));

  protected producto(id: number): string {
    return this.store.s().productos.find((p) => p.id === id)?.nombre ?? '—';
  }
  protected material(id: number): string {
    return this.store.s().materiales.find((m) => m.id === id)?.nombre ?? '—';
  }
  protected pendiente(ordenId: number, estacion: number): boolean {
    const orden = this.store.s().ordenesProduccion.find((o) => o.id === ordenId)!;
    return orden.avance[estacion] < this.store.limiteEstacion(ordenId, estacion);
  }

  protected async crear(): Promise<void> {
    let id = 0;
    const ok = await this.avisos.intentar(async () => {
      id = await this.store.crearOrdenProduccion(this.productoNuevo(), this.cantidadNueva());
    });
    if (ok) {
      this.nuevaAbierta.set(false);
      this.seleccionId.set(id);
      this.avisos.mostrar(`Orden ${codigoDoc('OP', id)} creada. Iníciala para consumir el material.`);
    }
  }
  protected iniciar(id: number): void {
    void this.avisos.intentar(() => this.store.iniciarOrdenProduccion(id), `${codigoDoc('OP', id)} iniciada: material descontado.`);
    this.seleccionId.set(id);
  }
  protected cancelar(id: number): void {
    void this.avisos.intentar(() => this.store.cancelarOrdenProduccion(id), `${codigoDoc('OP', id)} cancelada.`);
  }
  protected avanzar(id: number, estacion: number, resultado?: 'aprobada' | 'rechazada'): void {
    void this.avisos.intentar(() => this.store.registrarAvance(id, estacion, resultado));
  }
}

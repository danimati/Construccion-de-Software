import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ErpStore } from '../core/erp-store';
import { MovimientoInventario, TipoMovimiento } from '../core/models';
import { Avisos, CopPipe, Estado, Modal, NumPipe } from '../shared/ui';

const TIPOS: Record<TipoMovimiento, string> = {
  entrada_compra: 'Entrada por compra',
  salida_produccion: 'Salida a producción',
  entrada_produccion: 'Entrada de producción',
  salida_venta: 'Salida por venta',
  devolucion_venta: 'Devolución de venta',
  ajuste: 'Ajuste',
};

@Component({
  selector: 'nk-inventario',
  imports: [FormsModule, DatePipe, CopPipe, NumPipe, Estado, Modal],
  template: `
    <div class="pagina">
      <header class="cab">
        <div>
          <h1>Inventario</h1>
          <p>Materias primas, productos terminados y listas de materiales</p>
        </div>
        @if (puedeEditar()) {
          <button type="button" class="btn btn-pri" (click)="ajusteAbierto.set(true)">Registrar movimiento</button>
        }
      </header>

      <div class="pestanas">
        @for (p of pestanas; track p.id) {
          <button type="button" [attr.aria-pressed]="pestana() === p.id" (click)="pestana.set(p.id)">{{ p.nombre }}</button>
        }
      </div>

      @switch (pestana()) {
        @case ('materiales') {
          <section class="tarjeta tabla-caja" aria-label="Materiales">
            <table>
              <thead><tr><th>Código</th><th>Material</th><th class="der">Stock</th><th class="der">Mínimo</th><th class="der">Costo unit.</th><th>Estado</th></tr></thead>
              <tbody>
                @for (m of store.s().materiales; track m.id) {
                  <tr>
                    <td class="mono">{{ m.codigo }}</td>
                    <td>{{ m.nombre }}</td>
                    <td class="der"><span class="fuerte">{{ m.stockActual | num }}</span> <small class="suave">{{ m.unidadMedida }}</small></td>
                    <td class="der">{{ m.stockMinimo | num }}</td>
                    <td class="der">{{ m.costoUnitario | cop }}</td>
                    <td><nk-estado [valor]="m.stockActual < m.stockMinimo ? 'bajo_minimo' : 'disponible'" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }
        @case ('productos') {
          <div class="con-lateral">
            <section class="tarjeta tabla-caja principal" aria-label="Productos">
              <table>
                <thead><tr><th>SKU</th><th>Producto</th><th class="der">Stock</th><th class="der">Precio</th><th class="der">Fabricables</th><th><span class="sr">Acción</span></th></tr></thead>
                <tbody>
                  @for (p of store.s().productos; track p.id) {
                    <tr [class.fila-sel]="p.id === productoId()">
                      <td class="mono">{{ p.sku }}</td>
                      <td>{{ p.nombre }}</td>
                      <td class="der fuerte">{{ p.stockActual | num }}</td>
                      <td class="der">{{ p.precioVenta | cop }}</td>
                      <td class="der">{{ store.capacidadFabricacion(p.id).unidades | num }}</td>
                      <td class="der"><button type="button" class="btn btn-chico" (click)="productoId.set(p.id)">Ver lista</button></td>
                    </tr>
                  }
                </tbody>
              </table>
            </section>
            <aside class="tarjeta lateral" aria-labelledby="bom">
              <h2 id="bom">Lista de materiales</h2>
              <p class="chico suave">{{ producto()?.nombre }}</p>
              <ul class="lista" style="margin-top: 10px">
                @for (l of bom(); track l.materialId) {
                  <li><span>{{ l.nombre }}</span><span class="fuerte">{{ l.cantidad | num }}</span></li>
                }
              </ul>
              <p class="fuerte" style="display: flex; justify-content: space-between; margin-top: 12px">
                <span>Se pueden fabricar</span><span>{{ capacidad().unidades | num }} und</span>
              </p>
              @if (capacidad().limitante) {
                <p class="chico suave">Limita: {{ capacidad().limitante }}</p>
              }
            </aside>
          </div>
        }
        @case ('movimientos') {
          <section class="tarjeta tabla-caja" aria-label="Movimientos">
            <table>
              <thead><tr><th>Fecha</th><th>Ítem</th><th>Tipo</th><th class="der">Cantidad</th><th>Documento</th><th>Usuario</th></tr></thead>
              <tbody>
                @for (m of movimientos(); track m.id) {
                  <tr>
                    <td>{{ m.fecha | date: 'd MMM y, HH:mm' }}</td>
                    <td>{{ item(m) }}</td>
                    <td>{{ tipos[m.tipo] }}</td>
                    <td class="der fuerte">{{ m.cantidad | num }}</td>
                    <td class="mono">{{ m.documentoRef }}</td>
                    <td class="mono">{{ m.usuario }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }
      }
    </div>

    <nk-modal titulo="Registrar movimiento de ajuste" [abierto]="ajusteAbierto()" (cerrado)="ajusteAbierto.set(false)">
      <form class="form" (ngSubmit)="guardarAjuste()">
        <label class="campo">Ítem
          <select name="item" [(ngModel)]="itemAjuste">
            <optgroup label="Materiales">
              @for (m of store.s().materiales; track m.id) { <option [value]="'m' + m.id">{{ m.nombre }}</option> }
            </optgroup>
            <optgroup label="Productos">
              @for (p of store.s().productos; track p.id) { <option [value]="'p' + p.id">{{ p.nombre }}</option> }
            </optgroup>
          </select>
        </label>
        <div class="form-2">
          <label class="campo">Cantidad (negativa para restar)
            <input name="cantidad" type="number" step="1" [(ngModel)]="cantidadAjuste" />
          </label>
          <label class="campo">Motivo
            <input name="motivo" maxlength="40" [(ngModel)]="motivoAjuste" />
          </label>
        </div>
        <div class="form-pie"><span></span><button type="submit" class="btn btn-pri">Guardar movimiento</button></div>
      </form>
    </nk-modal>
  `,
})
export class Inventario {
  protected readonly store = inject(ErpStore);
  private readonly avisos = inject(Avisos);

  protected readonly tipos = TIPOS;
  protected readonly pestanas = [
    { id: 'materiales', nombre: 'Materiales' },
    { id: 'productos', nombre: 'Productos' },
    { id: 'movimientos', nombre: 'Movimientos' },
  ] as const;
  protected readonly pestana = signal<'materiales' | 'productos' | 'movimientos'>('materiales');
  protected readonly productoId = signal(1);
  protected readonly puedeEditar = computed(() => this.store.puede('inventario', 'editar'));

  protected readonly producto = computed(() => this.store.s().productos.find((p) => p.id === this.productoId()));
  protected readonly capacidad = computed(() => this.store.capacidadFabricacion(this.productoId()));
  protected readonly bom = computed(() => {
    const { listaMateriales, materiales } = this.store.s();
    return listaMateriales
      .filter((l) => l.productoId === this.productoId())
      .map((l) => ({ ...l, nombre: materiales.find((m) => m.id === l.materialId)!.nombre }));
  });
  protected readonly movimientos = computed(() => [...this.store.s().movimientos].sort((a, b) => b.id - a.id));

  protected readonly ajusteAbierto = signal(false);
  protected readonly itemAjuste = signal('m1');
  protected readonly cantidadAjuste = signal<number | null>(null);
  protected readonly motivoAjuste = signal('');

  protected item(m: MovimientoInventario): string {
    const { materiales, productos } = this.store.s();
    return (m.materialId ? materiales.find((x) => x.id === m.materialId) : productos.find((x) => x.id === m.productoId))?.nombre ?? '—';
  }

  protected async guardarAjuste(): Promise<void> {
    const item = this.itemAjuste();
    const id = Number(item.slice(1));
    const ref = item[0] === 'm' ? { materialId: id } : { productoId: id };
    const ok = await this.avisos.intentar(
      () => this.store.registrarAjuste(ref, this.cantidadAjuste(), this.motivoAjuste()),
      'Movimiento registrado.',
    );
    if (ok) {
      this.ajusteAbierto.set(false);
      this.cantidadAjuste.set(null);
      this.motivoAjuste.set('');
    }
  }
}

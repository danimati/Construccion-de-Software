import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ErpStore, LineaCompraNueva, codigoDoc, totalLineas } from '../core/erp-store';
import { CuentaPorPagar, OrdenCompra } from '../core/models';
import { Avisos, CopPipe, DocPipe, Estado, Modal, NumPipe } from '../shared/ui';

@Component({
  selector: 'nk-compras',
  imports: [FormsModule, DatePipe, CopPipe, DocPipe, NumPipe, Estado, Modal],
  template: `
    <div class="pagina">
      <header class="cab">
        <div>
          <h1>Compras</h1>
          <p>Proveedores, órdenes de compra y cuentas por pagar</p>
        </div>
        @if (puedeEditar()) {
          <button type="button" class="btn btn-pri" (click)="abrirOrden()">Nueva orden de compra</button>
        }
      </header>

      <section class="tarjeta tabla-caja" aria-labelledby="oc">
        <h2 id="oc">Órdenes de compra</h2>
        <table>
          <thead><tr><th>Orden</th><th>Proveedor</th><th>Material</th><th class="der">Recibido</th><th class="der">Total</th><th>Estado</th>
            @if (puedeEditar()) { <th><span class="sr">Acción</span></th> }
          </tr></thead>
          <tbody>
            @for (o of ordenes(); track o.id) {
              <tr>
                <td class="mono">{{ o.id | doc: 'OC' }}</td>
                <td>{{ proveedor(o.proveedorId) }}</td>
                <td>{{ materiales(o) }}</td>
                <td class="der">{{ recibido(o) | num }} de {{ pedido(o) | num }}</td>
                <td class="der fuerte">{{ o.total | cop }}</td>
                <td><nk-estado [valor]="o.estado" /></td>
                @if (puedeEditar()) {
                  <td class="der">
                    @if (o.estado === 'enviada' || o.estado === 'parcial') {
                      <button type="button" class="btn btn-chico" (click)="abrirRecepcion(o)">Registrar recepción</button>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </section>

      <div class="columnas">
        <section class="tarjeta tabla-caja" aria-labelledby="cxp">
          <h2 id="cxp">Cuentas por pagar</h2>
          @if (cuentas().length) {
            <table>
              <thead><tr><th>Orden</th><th class="der">Saldo</th><th>Vence</th>
                @if (puedeEditar()) { <th><span class="sr">Acción</span></th> }
              </tr></thead>
              <tbody>
                @for (c of cuentas(); track c.id) {
                  <tr>
                    <td class="mono">{{ c.ordenCompraId | doc: 'OC' }}</td>
                    <td class="der fuerte">{{ c.saldo | cop }}</td>
                    <td>{{ c.fechaVencimiento + 'T12:00:00' | date: 'd MMM y' }}</td>
                    @if (puedeEditar()) {
                      <td class="der"><button type="button" class="btn btn-chico" (click)="abrirPago(c)">Registrar pago</button></td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="vacio">No hay cuentas abiertas.</p>
          }
        </section>
        <section class="tarjeta tabla-caja" aria-labelledby="prov">
          <div class="tarjeta-cab">
            <h2 id="prov">Proveedores</h2>
            @if (puedeEditar()) {
              <button type="button" class="btn btn-chico" (click)="proveedorAbierto.set(true)">Nuevo proveedor</button>
            }
          </div>
          <table>
            <thead><tr><th>Razón social</th><th>NIT</th><th>Contacto</th></tr></thead>
            <tbody>
              @for (p of store.s().proveedores; track p.id) {
                <tr><td>{{ p.razonSocial }}</td><td class="mono">{{ p.nit }}</td><td>{{ p.contacto }}</td></tr>
              }
            </tbody>
          </table>
        </section>
      </div>
    </div>

    <nk-modal titulo="Nueva orden de compra" [abierto]="ordenAbierta()" (cerrado)="ordenAbierta.set(false)">
      <form class="form" (ngSubmit)="crearOrden()">
        <label class="campo">Proveedor
          <select name="proveedor" [ngModel]="proveedorId()" (ngModelChange)="proveedorId.set($event)">
            @for (p of store.s().proveedores; track p.id) { <option [ngValue]="p.id">{{ p.razonSocial }}</option> }
          </select>
        </label>
        @for (l of lineas(); track $index; let i = $index) {
          <div class="linea-form">
            <label class="campo">Material
              <select [name]="'mat' + i" [ngModel]="l.materialId" (ngModelChange)="elegirMaterial(l, $event)">
                @for (m of store.s().materiales; track m.id) { <option [ngValue]="m.id">{{ m.nombre }}</option> }
              </select>
            </label>
            <label class="campo">Cantidad
              <input [name]="'cant' + i" type="number" min="1" [(ngModel)]="l.cantidad" />
            </label>
            <label class="campo">Precio unit.
              <input [name]="'prec' + i" type="number" min="1" [(ngModel)]="l.precioUnitario" />
            </label>
            <button type="button" class="btn" aria-label="Quitar línea" [disabled]="lineas().length === 1" (click)="quitarLinea(i)">×</button>
          </div>
        }
        <div class="form-pie">
          <button type="button" class="btn btn-chico" (click)="agregarLinea()">Agregar línea</button>
          <span class="fuerte">Total {{ total() | cop }}</span>
        </div>
        <div class="form-pie"><span></span><button type="submit" class="btn btn-pri">Crear orden</button></div>
      </form>
    </nk-modal>

    <nk-modal [titulo]="'Recepción de ' + (recepcion()?.id ?? 0 | doc: 'OC')" [abierto]="!!recepcion()" (cerrado)="recepcion.set(null)">
      <form class="form" (ngSubmit)="guardarRecepcion()">
        @for (l of recepcion()?.detalles ?? []; track l.id) {
          <label class="campo">{{ material(l.materialId) }} · pendientes {{ l.cantidad - l.cantidadRecibida | num }}
            <input [name]="'r' + l.id" type="number" min="0" [max]="l.cantidad - l.cantidadRecibida" [(ngModel)]="cantidades[l.id]" />
          </label>
        }
        <p class="chico suave">Al guardar se suman las existencias y se actualiza la cuenta por pagar.</p>
        <div class="form-pie"><span></span><button type="submit" class="btn btn-pri">Guardar recepción</button></div>
      </form>
    </nk-modal>

    <nk-modal titulo="Registrar pago" [abierto]="!!cuentaPago()" (cerrado)="cuentaPago.set(null)">
      <form class="form" (ngSubmit)="guardarPago()">
        <label class="campo">Monto · saldo {{ cuentaPago()?.saldo ?? 0 | cop }}
          <input name="monto" type="number" min="1" [(ngModel)]="montoPago" />
        </label>
        <div class="form-pie"><span></span><button type="submit" class="btn btn-pri">Registrar pago</button></div>
      </form>
    </nk-modal>

    <nk-modal titulo="Nuevo proveedor" [abierto]="proveedorAbierto()" (cerrado)="proveedorAbierto.set(false)">
      <form class="form" (ngSubmit)="crearProveedor()">
        <div class="form-2">
          <label class="campo">NIT <input name="nit" [(ngModel)]="nuevoProveedor.nit" /></label>
          <label class="campo">Razón social <input name="razon" [(ngModel)]="nuevoProveedor.razonSocial" /></label>
          <label class="campo">Contacto <input name="contacto" [(ngModel)]="nuevoProveedor.contacto" /></label>
          <label class="campo">Correo <input name="email" type="email" [(ngModel)]="nuevoProveedor.email" /></label>
          <label class="campo">Teléfono <input name="tel" [(ngModel)]="nuevoProveedor.telefono" /></label>
        </div>
        <div class="form-pie"><span></span><button type="submit" class="btn btn-pri">Guardar proveedor</button></div>
      </form>
    </nk-modal>
  `,
})
export class Compras {
  protected readonly store = inject(ErpStore);
  private readonly avisos = inject(Avisos);

  protected readonly puedeEditar = computed(() => this.store.puede('compras', 'editar'));
  protected readonly ordenes = computed(() => [...this.store.s().ordenesCompra].sort((a, b) => b.id - a.id));
  protected readonly cuentas = this.store.cuentasAbiertas;

  protected readonly ordenAbierta = signal(false);
  protected readonly proveedorId = signal(1);
  protected readonly lineas = signal<LineaCompraNueva[]>([]);

  protected readonly recepcion = signal<OrdenCompra | null>(null);
  protected cantidades: Record<number, number> = {};

  protected readonly cuentaPago = signal<CuentaPorPagar | null>(null);
  protected readonly montoPago = signal<number | null>(null);

  protected readonly proveedorAbierto = signal(false);
  protected nuevoProveedor = this.proveedorVacio();

  private proveedorVacio() {
    return { nit: '', razonSocial: '', contacto: '', email: '', telefono: '' };
  }

  protected proveedor(id: number): string {
    return this.store.s().proveedores.find((p) => p.id === id)?.razonSocial ?? '—';
  }
  protected material(id: number): string {
    return this.store.s().materiales.find((m) => m.id === id)?.nombre ?? '—';
  }
  protected materiales(o: OrdenCompra): string {
    return o.detalles.map((l) => this.material(l.materialId)).join(', ');
  }
  protected recibido(o: OrdenCompra): number {
    return o.detalles.reduce((t, l) => t + l.cantidadRecibida, 0);
  }
  protected pedido(o: OrdenCompra): number {
    return o.detalles.reduce((t, l) => t + l.cantidad, 0);
  }
  protected total(): number {
    return totalLineas(this.lineas());
  }

  private lineaNueva(): LineaCompraNueva {
    const m = this.store.materialesBajoMinimo()[0] ?? this.store.s().materiales[0];
    return { materialId: m.id, cantidad: 100, precioUnitario: m.costoUnitario };
  }
  protected abrirOrden(): void {
    this.lineas.set([this.lineaNueva()]);
    this.ordenAbierta.set(true);
  }
  protected agregarLinea(): void {
    this.lineas.update((l) => [...l, this.lineaNueva()]);
  }
  protected quitarLinea(i: number): void {
    this.lineas.update((l) => l.filter((_, x) => x !== i));
  }
  protected elegirMaterial(linea: LineaCompraNueva, materialId: number): void {
    linea.materialId = materialId;
    linea.precioUnitario = this.store.s().materiales.find((m) => m.id === materialId)?.costoUnitario ?? 0;
  }
  protected async crearOrden(): Promise<void> {
    let id = 0;
    const ok = await this.avisos.intentar(async () => {
      id = await this.store.crearOrdenCompra(this.proveedorId(), this.lineas());
    });
    if (ok) {
      this.ordenAbierta.set(false);
      this.avisos.mostrar(`Orden ${codigoDoc('OC', id)} creada.`);
    }
  }

  protected abrirRecepcion(o: OrdenCompra): void {
    this.cantidades = Object.fromEntries(o.detalles.map((l) => [l.id, l.cantidad - l.cantidadRecibida]));
    this.recepcion.set(o);
  }
  protected async guardarRecepcion(): Promise<void> {
    const orden = this.recepcion();
    if (!orden) return;
    const ok = await this.avisos.intentar(
      () => this.store.registrarRecepcion(orden.id, this.cantidades),
      'Recepción registrada: existencias actualizadas.',
    );
    if (ok) this.recepcion.set(null);
  }

  protected abrirPago(c: CuentaPorPagar): void {
    this.montoPago.set(c.saldo);
    this.cuentaPago.set(c);
  }
  protected async guardarPago(): Promise<void> {
    const cuenta = this.cuentaPago();
    if (!cuenta) return;
    const ok = await this.avisos.intentar(() => this.store.registrarPago(cuenta.id, this.montoPago()), 'Pago registrado.');
    if (ok) this.cuentaPago.set(null);
  }

  protected async crearProveedor(): Promise<void> {
    const ok = await this.avisos.intentar(() => this.store.crearProveedor(this.nuevoProveedor), 'Proveedor creado.');
    if (ok) {
      this.proveedorAbierto.set(false);
      this.nuevoProveedor = this.proveedorVacio();
    }
  }
}

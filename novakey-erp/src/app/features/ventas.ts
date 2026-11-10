import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ErpStore, LineaNueva, codigoDoc, fechaLocal, totalLineas } from '../core/erp-store';
import { Cliente } from '../core/models';
import { Avisos, CopPipe, DocPipe, Estado, Modal, NumPipe } from '../shared/ui';

type Pestana = 'pedidos' | 'cotizaciones' | 'clientes' | 'facturas';
type ModoDocumento = 'cotizacion' | 'pedido';

@Component({
  selector: 'nk-ventas',
  imports: [FormsModule, DatePipe, CopPipe, DocPipe, NumPipe, Estado, Modal],
  template: `
    <div class="pagina">
      <header class="cab">
        <div>
          <h1>Ventas (CRM)</h1>
          <p>Clientes B2B y B2C, cotizaciones, pedidos y facturación</p>
        </div>
        @if (puedeEditar()) {
          <div class="acciones">
            <button type="button" class="btn" (click)="abrirDocumento('pedido')">Nuevo pedido</button>
            <button type="button" class="btn btn-pri" (click)="abrirDocumento('cotizacion')">Nueva cotización</button>
          </div>
        }
      </header>

      <div class="pestanas">
        @for (p of pestanas; track p.id) {
          <button type="button" [attr.aria-pressed]="pestana() === p.id" (click)="pestana.set(p.id)">{{ p.nombre }}</button>
        }
      </div>

      <div class="con-lateral">
        <div class="principal">
          @switch (pestana()) {
            @case ('pedidos') {
              <section class="tarjeta tabla-caja" aria-label="Pedidos">
                <table>
                  <thead><tr><th>Pedido</th><th>Cliente</th><th>Tipo</th><th>Canal</th><th class="der">Valor</th><th>Estado</th>
                    @if (puedeEditar()) { <th><span class="sr">Acciones</span></th> }
                  </tr></thead>
                  <tbody>
                    @for (p of pedidos(); track p.id) {
                      <tr>
                        <td class="mono">{{ p.id | doc: 'PED' }}</td>
                        <td>{{ cliente(p.clienteId)?.nombre }}</td>
                        <td>{{ cliente(p.clienteId)?.tipo === 'corp' ? 'Corporativo' : 'Consumidor final' }}</td>
                        <td>{{ p.canal === 'web' ? 'Web' : 'Directo' }}</td>
                        <td class="der fuerte">{{ valor(p.detalles) | cop }}</td>
                        <td><nk-estado [valor]="p.estado" /></td>
                        @if (puedeEditar()) {
                          <td class="der">
                            <span class="grupo-btn">
                              @if (p.estado === 'confirmado') {
                                <button type="button" class="btn btn-chico" (click)="preparar(p.id)">Preparar</button>
                              }
                              @if (p.estado === 'confirmado' || p.estado === 'en_preparacion') {
                                <button type="button" class="btn btn-chico btn-pri" (click)="facturar(p.id)">Facturar</button>
                                <button type="button" class="btn btn-chico" (click)="cancelar(p.id)">Cancelar</button>
                              }
                            </span>
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </section>
            }
            @case ('cotizaciones') {
              <section class="tarjeta tabla-caja" aria-label="Cotizaciones">
                <table>
                  <thead><tr><th>Cotización</th><th>Cliente</th><th>Vigencia</th><th class="der">Total</th><th>Estado</th>
                    @if (puedeEditar()) { <th><span class="sr">Acciones</span></th> }
                  </tr></thead>
                  <tbody>
                    @for (c of cotizaciones(); track c.id) {
                      <tr>
                        <td class="mono">{{ c.id | doc: 'COT' }}</td>
                        <td>{{ cliente(c.clienteId)?.nombre }}</td>
                        <td>{{ c.vigencia + 'T12:00:00' | date: 'd MMM y' }}</td>
                        <td class="der fuerte">{{ c.total | cop }}</td>
                        <td><nk-estado [valor]="c.estado" /></td>
                        @if (puedeEditar()) {
                          <td class="der">
                            @if (c.estado === 'enviada') {
                              <span class="grupo-btn">
                                <button type="button" class="btn btn-chico btn-pri" (click)="convertir(c.id)">Convertir en pedido</button>
                                <button type="button" class="btn btn-chico" (click)="rechazar(c.id)">Rechazar</button>
                              </span>
                            }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </section>
            }
            @case ('clientes') {
              <section class="tarjeta tabla-caja" aria-label="Clientes">
                @if (puedeEditar()) {
                  <div class="tarjeta-cab">
                    <span class="suave chico">{{ store.s().clientes.length }} clientes registrados</span>
                    <button type="button" class="btn btn-chico" (click)="clienteAbierto.set(true)">Nuevo cliente</button>
                  </div>
                }
                <table>
                  <thead><tr><th>Nombre</th><th>Tipo</th><th>Documento</th><th>Correo</th><th>Teléfono</th></tr></thead>
                  <tbody>
                    @for (c of store.s().clientes; track c.id) {
                      <tr>
                        <td>{{ c.nombre }}</td>
                        <td>{{ c.tipo === 'corp' ? 'Corporativo' : 'Consumidor final' }}</td>
                        <td class="mono">{{ c.documento }}</td>
                        <td>{{ c.email }}</td>
                        <td>{{ c.telefono }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </section>
            }
            @case ('facturas') {
              <section class="tarjeta tabla-caja" aria-label="Facturas">
                <table>
                  <thead><tr><th>Factura</th><th>Pedido</th><th>Fecha</th><th class="der">Subtotal</th><th class="der">IVA</th><th class="der">Total</th><th>Estado</th>
                    @if (puedeEditar()) { <th><span class="sr">Acción</span></th> }
                  </tr></thead>
                  <tbody>
                    @for (f of facturas(); track f.id) {
                      <tr>
                        <td class="mono">{{ f.numero }}</td>
                        <td class="mono">{{ f.pedidoId | doc: 'PED' }}</td>
                        <td>{{ f.fecha + 'T12:00:00' | date: 'd MMM y' }}</td>
                        <td class="der">{{ f.subtotal | cop }}</td>
                        <td class="der">{{ f.impuestos | cop }}</td>
                        <td class="der fuerte">{{ f.total | cop }}</td>
                        <td><nk-estado [valor]="f.estado" /></td>
                        @if (puedeEditar()) {
                          <td class="der">
                            @if (f.estado === 'emitida') {
                              <button type="button" class="btn btn-chico" (click)="marcarPagada(f.id)">Marcar pagada</button>
                            }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </section>
            }
          }
        </div>
        <aside class="tarjeta lateral" aria-labelledby="disp">
          <h2 id="disp">Disponibilidad</h2>
          <ul class="lista">
            @for (p of store.s().productos; track p.id) {
              <li style="flex-direction: column; gap: 2px">
                <span style="display: flex; justify-content: space-between; gap: 12px"><span>{{ p.nombre }}</span><span class="fuerte">{{ p.stockActual | num }} und</span></span>
                <small class="suave">{{ p.precioVenta | cop }} antes de IVA</small>
              </li>
            }
          </ul>
        </aside>
      </div>
    </div>

    <nk-modal [titulo]="modo() === 'pedido' ? 'Nuevo pedido' : 'Nueva cotización'" [abierto]="documentoAbierto()" (cerrado)="documentoAbierto.set(false)">
      <form class="form" (ngSubmit)="guardarDocumento()">
        <div class="form-2">
          <label class="campo">Cliente
            <select name="cliente" [ngModel]="clienteId()" (ngModelChange)="clienteId.set($event)">
              @for (c of store.s().clientes; track c.id) { <option [ngValue]="c.id">{{ c.nombre }}</option> }
            </select>
          </label>
          @if (modo() === 'cotizacion') {
            <label class="campo">Vigencia
              <input name="vigencia" type="date" [min]="hoy" [(ngModel)]="vigencia" />
            </label>
          }
        </div>
        @for (l of lineas(); track $index; let i = $index) {
          <div class="linea-form">
            <label class="campo">Producto
              <select [name]="'prod' + i" [ngModel]="l.productoId" (ngModelChange)="elegirProducto(l, $event)">
                @for (p of store.s().productos; track p.id) { <option [ngValue]="p.id">{{ p.nombre }} ({{ p.stockActual }})</option> }
              </select>
            </label>
            <label class="campo">Cantidad
              <input [name]="'cant' + i" type="number" min="1" step="1" [(ngModel)]="l.cantidad" />
            </label>
            <label class="campo">Precio unit.
              <input [name]="'prec' + i" type="number" min="1" [(ngModel)]="l.precioUnitario" />
            </label>
            <button type="button" class="btn" aria-label="Quitar línea" [disabled]="lineas().length === 1" (click)="quitarLinea(i)">×</button>
          </div>
        }
        <div class="form-pie">
          <button type="button" class="btn btn-chico" (click)="agregarLinea()">Agregar línea</button>
          <span class="fuerte">Total antes de IVA {{ valor(lineas()) | cop }}</span>
        </div>
        @if (modo() === 'pedido') {
          <p class="chico suave">Confirmar el pedido descuenta el producto de la disponibilidad.</p>
        }
        <div class="form-pie"><span></span>
          <button type="submit" class="btn btn-pri">{{ modo() === 'pedido' ? 'Confirmar pedido' : 'Guardar cotización' }}</button>
        </div>
      </form>
    </nk-modal>

    <nk-modal titulo="Nuevo cliente" [abierto]="clienteAbierto()" (cerrado)="clienteAbierto.set(false)">
      <form class="form" (ngSubmit)="crearCliente()">
        <div class="form-2">
          <label class="campo">Tipo
            <select name="tipo" [(ngModel)]="nuevoCliente.tipo">
              <option value="corp">Corporativo</option>
              <option value="final">Consumidor final</option>
            </select>
          </label>
          <label class="campo">Documento <input name="doc" [(ngModel)]="nuevoCliente.documento" /></label>
          <label class="campo">Nombre <input name="nombre" [(ngModel)]="nuevoCliente.nombre" /></label>
          <label class="campo">Correo <input name="email" type="email" [(ngModel)]="nuevoCliente.email" /></label>
          <label class="campo">Teléfono <input name="tel" [(ngModel)]="nuevoCliente.telefono" /></label>
          <label class="campo">Dirección <input name="dir" [(ngModel)]="nuevoCliente.direccion" /></label>
        </div>
        <div class="form-pie"><span></span><button type="submit" class="btn btn-pri">Guardar cliente</button></div>
      </form>
    </nk-modal>
  `,
})
export class Ventas {
  protected readonly store = inject(ErpStore);
  private readonly avisos = inject(Avisos);

  protected readonly hoy = fechaLocal();
  protected readonly pestanas: { id: Pestana; nombre: string }[] = [
    { id: 'pedidos', nombre: 'Pedidos' },
    { id: 'cotizaciones', nombre: 'Cotizaciones' },
    { id: 'clientes', nombre: 'Clientes' },
    { id: 'facturas', nombre: 'Facturas' },
  ];
  protected readonly pestana = signal<Pestana>('pedidos');
  protected readonly puedeEditar = computed(() => this.store.puede('ventas', 'editar'));

  protected readonly pedidos = computed(() => [...this.store.s().pedidos].sort((a, b) => b.id - a.id));
  protected readonly cotizaciones = computed(() => [...this.store.s().cotizaciones].sort((a, b) => b.id - a.id));
  protected readonly facturas = computed(() => [...this.store.s().facturas].sort((a, b) => b.id - a.id));

  protected readonly documentoAbierto = signal(false);
  protected readonly modo = signal<ModoDocumento>('cotizacion');
  protected readonly clienteId = signal(1);
  protected readonly vigencia = signal('');
  protected readonly lineas = signal<LineaNueva[]>([]);

  protected readonly clienteAbierto = signal(false);
  protected nuevoCliente = this.clienteVacio();

  private clienteVacio(): Omit<Cliente, 'id'> {
    return { tipo: 'corp', documento: '', nombre: '', email: '', telefono: '', direccion: '' };
  }

  protected cliente(id: number): Cliente | undefined {
    return this.store.s().clientes.find((c) => c.id === id);
  }
  protected valor(lineas: { cantidad: number; precioUnitario: number }[]): number {
    return totalLineas(lineas);
  }

  private lineaNueva(): LineaNueva {
    const p = this.store.s().productos[0];
    return { productoId: p.id, cantidad: 1, precioUnitario: p.precioVenta };
  }
  protected abrirDocumento(modo: ModoDocumento): void {
    this.modo.set(modo);
    this.lineas.set([this.lineaNueva()]);
    const vence = new Date();
    vence.setDate(vence.getDate() + 30);
    this.vigencia.set(fechaLocal(vence));
    this.documentoAbierto.set(true);
  }
  protected agregarLinea(): void {
    this.lineas.update((l) => [...l, this.lineaNueva()]);
  }
  protected quitarLinea(i: number): void {
    this.lineas.update((l) => l.filter((_, x) => x !== i));
  }
  protected elegirProducto(linea: LineaNueva, productoId: number): void {
    linea.productoId = productoId;
    linea.precioUnitario = this.store.s().productos.find((p) => p.id === productoId)?.precioVenta ?? 0;
  }
  protected async guardarDocumento(): Promise<void> {
    const esPedido = this.modo() === 'pedido';
    let id = 0;
    const ok = await this.avisos.intentar(async () => {
      id = esPedido
        ? await this.store.crearPedido(this.clienteId(), this.lineas())
        : await this.store.crearCotizacion(this.clienteId(), this.lineas(), this.vigencia());
    });
    if (ok) {
      this.documentoAbierto.set(false);
      this.pestana.set(esPedido ? 'pedidos' : 'cotizaciones');
      this.avisos.mostrar(esPedido ? `Pedido ${codigoDoc('PED', id)} confirmado.` : `Cotización ${codigoDoc('COT', id)} guardada.`);
    }
  }

  protected async convertir(id: number): Promise<void> {
    let pedido = 0;
    const ok = await this.avisos.intentar(async () => {
      pedido = await this.store.convertirEnPedido(id);
    });
    if (ok) {
      this.pestana.set('pedidos');
      this.avisos.mostrar(`Pedido ${codigoDoc('PED', pedido)} creado desde la cotización.`);
    }
  }
  protected rechazar(id: number): void {
    void this.avisos.intentar(() => this.store.rechazarCotizacion(id), 'Cotización rechazada.');
  }
  protected preparar(id: number): void {
    void this.avisos.intentar(() => this.store.prepararPedido(id), 'Pedido en preparación.');
  }
  protected cancelar(id: number): void {
    if (!confirm(`¿Cancelar ${codigoDoc('PED', id)}? El producto vuelve a estar disponible.`)) return;
    void this.avisos.intentar(() => this.store.cancelarPedido(id), 'Pedido cancelado: stock devuelto.');
  }
  protected async facturar(id: number): Promise<void> {
    let numero = '';
    const ok = await this.avisos.intentar(async () => {
      numero = await this.store.facturarPedido(id);
    });
    if (ok) this.avisos.mostrar(`Factura ${numero} emitida.`);
  }
  protected marcarPagada(id: number): void {
    void this.avisos.intentar(() => this.store.marcarFacturaPagada(id), 'Factura marcada como pagada.');
  }
  protected async crearCliente(): Promise<void> {
    const ok = await this.avisos.intentar(() => this.store.crearCliente(this.nuevoCliente), 'Cliente creado.');
    if (ok) {
      this.clienteAbierto.set(false);
      this.nuevoCliente = this.clienteVacio();
    }
  }
}

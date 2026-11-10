import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ErpStore, fechaLocal } from '../core/erp-store';
import { Empleado, EstadoEmpleado, Nomina } from '../core/models';
import { Avisos, CopPipe, Estado, Modal } from '../shared/ui';

@Component({
  selector: 'nk-recursos-humanos',
  imports: [FormsModule, DatePipe, CopPipe, Estado, Modal],
  template: `
    <div class="pagina">
      <header class="cab">
        <div>
          <h1>Recursos Humanos</h1>
          <p>Expedientes, horarios y nómina del personal</p>
        </div>
        @if (puedeEditar()) {
          <button type="button" class="btn btn-pri" (click)="empleadoAbierto.set(true)">Nuevo empleado</button>
        }
      </header>

      <section class="tarjeta tabla-caja" aria-labelledby="emp">
        <h2 id="emp">Empleados</h2>
        <table>
          <thead><tr><th>Nombre</th><th>Documento</th><th>Cargo</th><th>Área</th><th>Horario</th><th>Estado</th></tr></thead>
          <tbody>
            @for (e of store.s().empleados; track e.id) {
              <tr>
                <td class="fuerte">{{ e.nombres }} {{ e.apellidos }}</td>
                <td class="mono">{{ e.documento }}</td>
                <td>{{ cargo(e)?.nombre }}</td>
                <td>{{ area(e) }}</td>
                <td>{{ horario(e.id) }}</td>
                <td>
                  @if (puedeEditar()) {
                    <select class="control-chico" [attr.aria-label]="'Estado de ' + e.nombres + ' ' + e.apellidos" [ngModel]="e.estado" (ngModelChange)="cambiarEstado(e.id, $event)">
                      <option value="activo">Activo</option>
                      <option value="vacaciones">Vacaciones</option>
                      <option value="retirado">Retirado</option>
                    </select>
                  } @else {
                    <nk-estado [valor]="e.estado" />
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </section>

      <section class="tarjeta tabla-caja" aria-labelledby="nom">
        <div class="tarjeta-cab">
          <div>
            @if (nomina(); as n) {
              <h2 id="nom">Nómina · {{ n.periodoInicio + 'T12:00:00' | date: 'MMMM y' }}</h2>
              <p class="chico suave">
                @if (n.estado === 'pagada') {
                  Pagada el {{ n.fechaPago + 'T12:00:00' | date: 'd MMM y' }}
                } @else {
                  Borrador: revisa los devengados antes de pagar
                }
              </p>
            }
          </div>
          @if (puedeEditar()) {
            <div class="acciones">
              @if (nomina()?.estado === 'borrador') {
                <button type="button" class="btn btn-pri" (click)="pagar()">Pagar nómina</button>
              } @else {
                <button type="button" class="btn" (click)="generar()">Generar nómina de {{ siguiente().inicio + 'T12:00:00' | date: 'MMMM' }}</button>
              }
            </div>
          }
        </div>
        <table>
          <thead><tr><th>Empleado</th><th class="der">Salario base</th><th class="der">Devengados</th><th class="der">Deducciones</th><th class="der">Neto a pagar</th></tr></thead>
          <tbody>
            @for (d of nomina()?.detalles ?? []; track d.id) {
              <tr>
                <td>{{ empleado(d.empleadoId) }}</td>
                <td class="der">{{ d.salarioBase | cop }}</td>
                <td class="der">
                  @if (puedeEditar() && nomina()?.estado === 'borrador') {
                    <input class="control-chico der" style="width: 120px" type="number" min="0"
                      [attr.aria-label]="'Devengados de ' + empleado(d.empleadoId)"
                      [ngModel]="d.devengados" (change)="fijarDevengados(d.id, $event)" />
                  } @else {
                    {{ d.devengados | cop }}
                  }
                </td>
                <td class="der">{{ d.deducciones | cop }}</td>
                <td class="der fuerte">{{ d.netoPagar | cop }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr><td class="fuerte" colspan="4">Total</td><td class="der fuerte">{{ totalNeto() | cop }}</td></tr>
          </tfoot>
        </table>
      </section>
    </div>

    <nk-modal titulo="Nuevo empleado" [abierto]="empleadoAbierto()" (cerrado)="empleadoAbierto.set(false)">
      <form class="form" (ngSubmit)="crearEmpleado()">
        <div class="form-2">
          <label class="campo">Nombres <input name="nombres" [(ngModel)]="nuevo.nombres" /></label>
          <label class="campo">Apellidos <input name="apellidos" [(ngModel)]="nuevo.apellidos" /></label>
          <label class="campo">Documento <input name="doc" [(ngModel)]="nuevo.documento" /></label>
          <label class="campo">Cargo
            <select name="cargo" [(ngModel)]="nuevo.cargoId">
              @for (c of store.s().cargos; track c.id) { <option [ngValue]="c.id">{{ c.nombre }}</option> }
            </select>
          </label>
          <label class="campo">Correo <input name="email" type="email" [(ngModel)]="nuevo.email" /></label>
          <label class="campo">Teléfono <input name="tel" [(ngModel)]="nuevo.telefono" /></label>
          <label class="campo">Fecha de ingreso <input name="ingreso" type="date" [(ngModel)]="nuevo.fechaIngreso" /></label>
          <label class="campo">Entrada (lun a vie) <input name="ini" type="time" [(ngModel)]="horaInicio" /></label>
          <label class="campo">Salida (lun a vie) <input name="fin" type="time" [(ngModel)]="horaFin" /></label>
        </div>
        <div class="form-pie"><span></span><button type="submit" class="btn btn-pri">Guardar empleado</button></div>
      </form>
    </nk-modal>
  `,
})
export class RecursosHumanos {
  protected readonly store = inject(ErpStore);
  private readonly avisos = inject(Avisos);

  protected readonly puedeEditar = computed(() => this.store.puede('rh', 'editar'));
  protected readonly nomina = computed<Nomina | null>(() => [...this.store.s().nominas].sort((a, b) => b.id - a.id)[0] ?? null);
  protected readonly siguiente = computed(() => this.store.siguientePeriodo());
  protected readonly totalNeto = computed(() => (this.nomina()?.detalles ?? []).reduce((t, d) => t + d.netoPagar, 0));

  protected readonly empleadoAbierto = signal(false);
  protected nuevo = this.empleadoVacio();
  protected horaInicio = '08:00';
  protected horaFin = '17:00';

  private empleadoVacio(): Omit<Empleado, 'id' | 'estado'> {
    return { cargoId: 4, documento: '', nombres: '', apellidos: '', email: '', telefono: '', fechaIngreso: fechaLocal() };
  }

  protected cargo(e: Empleado) {
    return this.store.s().cargos.find((c) => c.id === e.cargoId);
  }
  protected area(e: Empleado): string {
    const c = this.cargo(e);
    return this.store.s().areas.find((a) => a.id === c?.areaId)?.nombre ?? '—';
  }
  protected empleado(id: number): string {
    const e = this.store.s().empleados.find((x) => x.id === id);
    return e ? `${e.nombres} ${e.apellidos}` : '—';
  }
  protected horario(empleadoId: number): string {
    const dias = this.store.s().horarios.filter((h) => h.empleadoId === empleadoId);
    if (!dias.length) return 'Sin horario';
    return `Lun a vie · ${dias[0].horaInicio.slice(0, 5)}–${dias[0].horaFin.slice(0, 5)}`;
  }

  protected cambiarEstado(id: number, estado: EstadoEmpleado): void {
    void this.avisos.intentar(() => this.store.cambiarEstadoEmpleado(id, estado));
  }
  protected generar(): void {
    void this.avisos.intentar(() => this.store.generarNomina(), 'Nómina generada en borrador.');
  }
  protected pagar(): void {
    const id = this.nomina()?.id;
    if (id) void this.avisos.intentar(() => this.store.pagarNomina(id), 'Nómina pagada.');
  }
  protected fijarDevengados(detalleId: number, evento: Event): void {
    const id = this.nomina()?.id;
    const valor = Number((evento.target as HTMLInputElement).value);
    if (id) void this.avisos.intentar(() => this.store.actualizarDevengados(id, detalleId, valor));
  }
  protected async crearEmpleado(): Promise<void> {
    const ok = await this.avisos.intentar(
      () => this.store.crearEmpleado(this.nuevo, this.horaInicio, this.horaFin),
      'Empleado creado.',
    );
    if (ok) {
      this.empleadoAbierto.set(false);
      this.nuevo = this.empleadoVacio();
    }
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ErpStore, ROL_ADMIN_ID } from '../core/erp-store';
import { MODULOS, Modulo, Nivel, Rol, Usuario } from '../core/models';
import { Avisos, Estado, Modal } from '../shared/ui';

const ETIQUETAS: Record<string, string> = { editar: 'Editar', ver: 'Ver', ninguno: 'Sin acceso' };

@Component({
  selector: 'nk-accesos',
  imports: [FormsModule, Estado, Modal],
  template: `
    <div class="pagina">
      <header class="cab">
        <div>
          <h1>Identidad y Accesos</h1>
          <p>Usuarios, roles y permisos por módulo</p>
        </div>
        @if (puedeEditar()) {
          <button type="button" class="btn btn-pri" (click)="usuarioAbierto.set(true)">Nuevo usuario</button>
        }
      </header>

      <section class="tarjeta tabla-caja" aria-labelledby="matriz">
        <h2 id="matriz">Permisos por rol</h2>
        <table>
          <thead><tr><th>Rol</th>
            @for (m of modulos; track m.id) { <th>{{ m.etiqueta }}</th> }
          </tr></thead>
          <tbody>
            @for (r of store.s().roles; track r.id) {
              <tr>
                <td><span class="fuerte">{{ r.nombre }}</span><br /><small class="suave">{{ r.descripcion }}</small></td>
                @for (m of modulos; track m.id) {
                  <td>
                    @if (puedeEditar() && !bloqueado(r, m.id)) {
                      <select class="control-chico" [attr.aria-label]="r.nombre + ' en ' + m.etiqueta"
                        [ngModel]="r.permisos[m.id] ?? 'ninguno'" (ngModelChange)="fijar(r.id, m.id, $event)">
                        <option value="editar">Editar</option>
                        <option value="ver">Ver</option>
                        <option value="ninguno">Sin acceso</option>
                      </select>
                    } @else {
                      {{ etiquetas[r.permisos[m.id] ?? 'ninguno'] }}
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </section>

      <section class="tarjeta tabla-caja" aria-labelledby="usu">
        <h2 id="usu">Usuarios</h2>
        <table>
          <thead><tr><th>Usuario</th><th>Empleado</th><th>Rol</th><th>Estado</th>
            @if (puedeEditar()) { <th><span class="sr">Acción</span></th> }
          </tr></thead>
          <tbody>
            @for (u of store.s().usuarios; track u.id) {
              <tr>
                <td class="mono">{{ u.username }}</td>
                <td>{{ empleado(u) }}</td>
                <td>
                  @if (puedeEditar() && u.id !== store.usuarioActualId()) {
                    <select class="control-chico" [attr.aria-label]="'Rol de ' + u.username" [ngModel]="u.rolIds[0]" (ngModelChange)="cambiarRol(u.id, $event)">
                      @for (r of store.s().roles; track r.id) { <option [ngValue]="r.id">{{ r.nombre }}</option> }
                    </select>
                  } @else {
                    {{ rol(u) }}
                  }
                </td>
                <td><nk-estado [valor]="u.activo ? 'activo' : 'inactivo'" /></td>
                @if (puedeEditar()) {
                  <td class="der">
                    @if (u.id !== store.usuarioActualId()) {
                      <button type="button" class="btn btn-chico" (click)="alternar(u)">{{ u.activo ? 'Desactivar' : 'Activar' }}</button>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </section>
    </div>

    <nk-modal titulo="Nuevo usuario" [abierto]="usuarioAbierto()" (cerrado)="usuarioAbierto.set(false)">
      <form class="form" (ngSubmit)="crear()">
        <div class="form-2">
          <label class="campo">Usuario <input name="username" autocomplete="off" [(ngModel)]="nuevo.username" /></label>
          <label class="campo">Correo <input name="email" type="email" autocomplete="off" [(ngModel)]="nuevo.email" /></label>
          <label class="campo">Contraseña inicial <input name="password" type="password" autocomplete="new-password" minlength="8" [(ngModel)]="nuevo.password" /></label>
          <label class="campo">Empleado
            <select name="empleado" [(ngModel)]="nuevo.empleadoId">
              <option [ngValue]="null">Sin empleado asociado</option>
              @for (e of empleadosLibres(); track e.id) { <option [ngValue]="e.id">{{ e.nombres }} {{ e.apellidos }}</option> }
            </select>
          </label>
          <label class="campo">Rol
            <select name="rol" [(ngModel)]="nuevo.rolId">
              @for (r of store.s().roles; track r.id) { <option [ngValue]="r.id">{{ r.nombre }}</option> }
            </select>
          </label>
        </div>
        <div class="form-pie"><span></span><button type="submit" class="btn btn-pri">Guardar usuario</button></div>
      </form>
    </nk-modal>
  `,
})
export class Accesos {
  protected readonly store = inject(ErpStore);
  private readonly avisos = inject(Avisos);

  protected readonly modulos = MODULOS;
  protected readonly etiquetas = ETIQUETAS;
  protected readonly puedeEditar = computed(() => this.store.puede('accesos', 'editar'));
  protected readonly empleadosLibres = computed(() => {
    const { empleados, usuarios } = this.store.s();
    return empleados.filter((e) => !usuarios.some((u) => u.empleadoId === e.id));
  });

  protected readonly usuarioAbierto = signal(false);
  protected nuevo = this.usuarioVacio();

  private usuarioVacio() {
    return { username: '', email: '', password: '', empleadoId: null as number | null, rolId: 2 };
  }

  protected bloqueado(rol: Rol, modulo: Modulo): boolean {
    return rol.id === ROL_ADMIN_ID && modulo === 'accesos';
  }
  protected empleado(u: Usuario): string {
    const e = this.store.s().empleados.find((x) => x.id === u.empleadoId);
    return e ? `${e.nombres} ${e.apellidos}` : '—';
  }
  protected rol(u: Usuario): string {
    return this.store.s().roles.filter((r) => u.rolIds.includes(r.id)).map((r) => r.nombre).join(', ');
  }

  protected fijar(rolId: number, modulo: Modulo, valor: string): void {
    const nivel: Nivel | null = valor === 'ninguno' ? null : (valor as Nivel);
    void this.avisos.intentar(() => this.store.fijarPermiso(rolId, modulo, nivel), 'Permiso actualizado.');
  }
  protected cambiarRol(id: number, rolId: number): void {
    void this.avisos.intentar(() => this.store.cambiarRolUsuario(id, rolId), 'Rol actualizado.');
  }
  protected alternar(u: Usuario): void {
    void this.avisos.intentar(() => this.store.fijarActivoUsuario(u.id, !u.activo));
  }
  protected async crear(): Promise<void> {
    const ok = await this.avisos.intentar(() => this.store.crearUsuario(this.nuevo), 'Usuario creado.');
    if (ok) {
      this.usuarioAbierto.set(false);
      this.nuevo = this.usuarioVacio();
    }
  }
}

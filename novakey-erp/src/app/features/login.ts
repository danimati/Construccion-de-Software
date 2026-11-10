import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ErpStore } from '../core/erp-store';
import { Logo, mensajeDeError } from '../shared/ui';

@Component({
  selector: 'nk-login',
  imports: [FormsModule, Logo],
  styles: `
    :host { display: flex; flex-wrap: wrap; min-height: 100vh; }
    .marca {
      flex: 1 1 420px; display: flex; flex-direction: column; justify-content: space-between; gap: 40px;
      background: var(--marino); color: #fff; padding: 56px;
    }
    .logo { display: flex; align-items: center; gap: 14px; }
    .logo strong { display: block; font-size: 26px; font-weight: 600; }
    .logo span { font-size: 15px; color: #b9cce2; }
    .marca h1 { font-size: 42px; line-height: 1.15; max-width: 560px; margin-bottom: 14px; }
    .marca p { font-size: 17px; line-height: 1.5; color: #dce7f3; max-width: 520px; }
    .marca .pie { font-size: 13px; color: #b9cce2; }
    .acceso { flex: 1 1 420px; display: flex; align-items: center; justify-content: center; padding: 40px 24px; }
    form { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 18px; }
    form h2 { font-size: 26px; }
    .error { padding: 10px 12px; border-radius: 6px; background: var(--alerta-fondo); color: var(--alerta); font-weight: 500; }
    .demo { border-top: 1px solid var(--linea); padding-top: 14px; display: flex; flex-direction: column; gap: 8px; }
    .demo-botones { display: flex; flex-wrap: wrap; gap: 6px; }
    @media (max-width: 640px) { .marca { padding: 28px 20px; } .marca h1 { font-size: 30px; } }
  `,
  template: `
    <section class="marca">
      <div class="logo">
        <nk-logo [tam]="56" />
        <div><strong>NovaKey</strong><span>teclados inteligentes</span></div>
      </div>
      <div>
        <h1>Del componente al despacho, en un solo sistema.</h1>
        <p>Inventario, producción, compras, ventas y personal con la misma información para todas las áreas.</p>
      </div>
      <p class="pie">Universidad Distrital · Construcción de Software · Grupo 020-81</p>
    </section>
    <section class="acceso">
      <form (ngSubmit)="entrar()">
        <div>
          <h2>Iniciar sesión</h2>
          <p class="suave">Verás los módulos que permite tu rol.</p>
        </div>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <label class="campo">Usuario
          <input name="usuario" autocomplete="username" required [(ngModel)]="usuario" />
        </label>
        <label class="campo">Contraseña
          <input name="contrasena" type="password" autocomplete="current-password" required [(ngModel)]="contrasena" />
        </label>
        <button type="submit" class="btn btn-pri" [disabled]="enviando()">{{ enviando() ? 'Entrando…' : 'Entrar' }}</button>
        @if (store.accesosDemo().length) {
        <div class="demo">
          <p class="chico suave">Demostración: elige un rol para rellenar el acceso.</p>
          <div class="demo-botones">
            @for (d of store.accesosDemo(); track d.username) {
              <button type="button" class="btn btn-chico" (click)="usar(d.username, d.password)">{{ d.rol }}</button>
            }
          </div>
        </div>
        }
      </form>
    </section>
  `,
})
export class Login {
  protected readonly store = inject(ErpStore);
  private readonly router = inject(Router);

  protected readonly usuario = signal('');
  protected readonly contrasena = signal('');
  protected readonly error = signal('');
  protected readonly enviando = signal(false);

  constructor() {
    void this.store.cargarAccesosDemo();
  }

  protected usar(username: string, password: string): void {
    this.usuario.set(username);
    this.contrasena.set(password);
    this.error.set('');
  }

  protected async entrar(): Promise<void> {
    this.enviando.set(true);
    this.error.set('');
    try {
      await this.store.iniciarSesion(this.usuario(), this.contrasena());
      void this.router.navigateByUrl('/panel');
    } catch (e) {
      if (!(e instanceof HttpErrorResponse)) throw e;
      this.store.limpiarSesion();
      this.error.set(e.status === 401 || e.status === 400 ? 'Usuario o contraseña incorrectos.' : mensajeDeError(e));
    } finally {
      this.enviando.set(false);
    }
  }
}

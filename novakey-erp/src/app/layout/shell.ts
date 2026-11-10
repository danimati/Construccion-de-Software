import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ErpStore } from '../core/erp-store';
import { MODULOS } from '../core/models';
import { Avisos, Logo } from '../shared/ui';

@Component({
  selector: 'nk-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo],
  styles: `
    :host { display: flex; flex-wrap: wrap; min-height: 100vh; }
    nav {
      flex: 1 1 248px; display: flex; flex-direction: column; gap: 24px;
      background: var(--marino); color: #fff; padding: 20px 14px;
    }
    main { flex: 999 1 560px; min-width: 0; }
    .marca { display: flex; align-items: center; gap: 10px; color: #fff; text-decoration: none; padding: 0 6px; }
    .marca:hover { color: #fff; }
    .marca strong { display: block; font-size: 18px; font-weight: 600; line-height: 1.2; }
    .marca span { font-size: 12px; color: #b9cce2; }
    .items { display: flex; flex-direction: column; gap: 4px; }
    .item {
      display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 10px; border-radius: 6px;
      text-decoration: none; color: #dce7f3;
    }
    .item:hover { background: #17406f; color: #fff; }
    .item.activo { background: var(--acento); color: #fff; font-weight: 600; }
    .cod { width: 30px; font-family: var(--mono); font-size: 12px; color: #9db6d2; }
    .activo .cod { color: #fff; }
    .pie { margin-top: auto; border-top: 1px solid #2a4e77; padding: 14px 6px 0; display: flex; flex-direction: column; gap: 2px; }
    .pie small { font-size: 12px; color: #b9cce2; }
    .enlace { align-self: flex-start; min-height: 28px; margin-top: 4px; padding: 0; background: none; border: 0; color: #bbd8f6; font: inherit; font-size: 13px; text-decoration: underline; cursor: pointer; }
    .aviso {
      position: fixed; right: 16px; bottom: 16px; max-width: min(460px, calc(100vw - 32px)); z-index: 10;
      padding: 12px 14px; border-radius: 8px; font-weight: 500; box-shadow: 0 4px 16px rgb(11 46 84 / 25%);
      background: var(--ok-fondo); color: var(--ok); border: 1px solid var(--ok);
    }
    .aviso.error { background: var(--alerta-fondo); color: var(--alerta); border-color: var(--alerta); }
    @media (min-width: 840px) { nav { flex: 0 0 248px; } }
  `,
  template: `
    <nav aria-label="Módulos del ERP">
      <a class="marca" routerLink="/panel">
        <nk-logo />
        <div><strong>NovaKey</strong><span>ERP interno</span></div>
      </a>
      <div class="items">
        <a class="item" routerLink="/panel" routerLinkActive="activo" ariaCurrentWhenActive="page">
          <span class="cod" aria-hidden="true">··</span>Panel general
        </a>
        @for (m of modulos(); track m.id) {
          <a class="item" [routerLink]="m.ruta" routerLinkActive="activo" ariaCurrentWhenActive="page">
            <span class="cod" aria-hidden="true">{{ m.codigo }}</span>{{ m.etiqueta }}
          </a>
        }
      </div>
      <div class="pie">
        <span>{{ nombre() }}</span>
        <small>{{ rol() }}</small>
        <button type="button" class="enlace" (click)="salir()">Cerrar sesión</button>
        @if (esDemo()) {
          <button type="button" class="enlace" (click)="restablecer()">Restablecer datos de ejemplo</button>
        }
      </div>
    </nav>
    <main>
      <router-outlet />
    </main>
    @if (avisos.actual(); as aviso) {
      <div class="aviso" [class.error]="aviso.tipo === 'error'" role="status">{{ aviso.texto }}</div>
    }
  `,
})
export class Shell {
  private readonly store = inject(ErpStore);
  private readonly router = inject(Router);
  protected readonly avisos = inject(Avisos);

  protected readonly modulos = computed(() => MODULOS.filter((m) => this.store.puede(m.id)));
  protected readonly nombre = computed(() => this.store.usuarioActual()?.nombre ?? '');
  protected readonly rol = computed(() => this.store.usuarioActual()?.roles.join(', ') ?? '');
  protected readonly esDemo = computed(() => this.store.accesosDemo().length > 0);

  protected salir(): void {
    this.store.cerrarSesion();
    this.avisos.actual.set(null);
    void this.router.navigateByUrl('/login');
  }

  protected restablecer(): void {
    if (!confirm('Se perderán los cambios hechos en esta demostración. ¿Continuar?')) return;
    void this.avisos.intentar(() => this.store.restablecerDatos(), 'Datos de ejemplo restablecidos.');
  }
}

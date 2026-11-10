import { Component, ElementRef, Injectable, inject, Pipe, PipeTransform, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ErpStore, codigoDoc } from '../core/erp-store';

const NUMERO = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

/** Pesos colombianos. `corto` muestra millones: $22,2 M. */
@Pipe({ name: 'cop' })
export class CopPipe implements PipeTransform {
  transform(valor: number, formato?: 'corto'): string {
    if (formato === 'corto' && Math.abs(valor) >= 1_000_000) return `$${DECIMAL.format(valor / 1_000_000)} M`;
    return `$${NUMERO.format(valor)}`;
  }
}

@Pipe({ name: 'num' })
export class NumPipe implements PipeTransform {
  transform(valor: number): string {
    return NUMERO.format(valor);
  }
}

@Pipe({ name: 'doc' })
export class DocPipe implements PipeTransform {
  transform(id: number | null, prefijo: string): string {
    return id === null ? '—' : codigoDoc(prefijo, id);
  }
}

type Tono = 'ok' | 'alerta' | '';
const ESTADOS: Record<string, [string, Tono]> = {
  activo: ['Activo', 'ok'],
  inactivo: ['Inactivo', 'alerta'],
  vacaciones: ['Vacaciones', ''],
  retirado: ['Retirado', 'alerta'],
  borrador: ['Borrador', 'alerta'],
  pagada: ['Pagada', 'ok'],
  enviada: ['Enviada', ''],
  parcial: ['Recibida en parte', 'alerta'],
  recibida: ['Recibida', 'ok'],
  cancelada: ['Cancelada', ''],
  abierta: ['Abierta', 'alerta'],
  planeada: ['Planeada', ''],
  en_proceso: ['En proceso', 'alerta'],
  terminada: ['Terminada', 'ok'],
  aprobada: ['Aprobada', 'ok'],
  rechazada: ['Rechazada', 'alerta'],
  aceptada: ['Aceptada', 'ok'],
  confirmado: ['Confirmado', ''],
  en_preparacion: ['En preparación', 'alerta'],
  facturado: ['Facturado', 'ok'],
  cancelado: ['Cancelado', ''],
  emitida: ['Emitida', 'alerta'],
  disponible: ['Disponible', 'ok'],
  bajo_minimo: ['Bajo mínimo', 'alerta'],
};

/** Etiqueta de estado: siempre lleva texto, el color solo refuerza. */
@Component({
  selector: 'nk-estado',
  template: `<span class="estado" [class.ok]="info()[1] === 'ok'" [class.alerta]="info()[1] === 'alerta'">{{ info()[0] }}</span>`,
})
export class Estado {
  readonly valor = input.required<string>();
  protected readonly info = computed(() => ESTADOS[this.valor()] ?? [this.valor(), '']);
}

@Component({
  selector: 'nk-logo',
  template: `<svg [attr.width]="tam()" [attr.height]="tam()" viewBox="0 0 48 48" aria-hidden="true">
    <rect x="2" y="6" width="40" height="40" rx="9" fill="#17599B" />
    <rect x="8" y="12" width="28" height="28" rx="6" fill="#3A74AD" />
    <path d="M14 26l8-7v4.5h9v5h-9V33z" fill="#BBD8F6" />
    <path d="M39 1L41.23 6.93L47.56 7.22L42.61 11.17L44.29 17.28L39 13.8L33.71 17.28L35.39 11.17L30.44 7.22L36.77 6.93Z" fill="#5AA5F0" />
  </svg>`,
})
export class Logo {
  readonly tam = input(38);
}

/** Diálogo nativo: gestiona el foco y la tecla Esc por sí mismo. */
@Component({
  selector: 'nk-modal',
  template: `<dialog #dialogo (close)="cerrado.emit()" [attr.aria-label]="titulo()">
    <header class="modal-cab">
      <h2>{{ titulo() }}</h2>
      <button type="button" class="btn btn-chico" (click)="cerrado.emit()">Cerrar</button>
    </header>
    <div class="modal-cuerpo"><ng-content /></div>
  </dialog>`,
})
export class Modal {
  readonly titulo = input.required<string>();
  readonly abierto = input(false);
  readonly cerrado = output<void>();
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const d = this.dialogo().nativeElement;
      if (this.abierto() && !d.open) d.showModal();
      if (!this.abierto() && d.open) d.close();
    });
  }
}

export interface Aviso {
  texto: string;
  tipo: 'ok' | 'error';
}

@Injectable({ providedIn: 'root' })
export class Avisos {
  readonly actual = signal<Aviso | null>(null);
  private readonly store = inject(ErpStore);
  private readonly router = inject(Router);
  private enCurso = false;
  private temporizador?: ReturnType<typeof setTimeout>;

  mostrar(texto: string, tipo: Aviso['tipo'] = 'ok'): void {
    this.actual.set({ texto, tipo });
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.actual.set(null), tipo === 'error' ? 7000 : 3500);
  }

  /**
   * Ejecuta una operación contra la API y muestra su resultado. Devuelve true si tuvo éxito.
   * Mientras hay una en curso ignora las demás, para que un doble clic no cree dos documentos.
   */
  async intentar(operacion: () => Promise<unknown>, exito?: string): Promise<boolean> {
    if (this.enCurso) return false;
    this.enCurso = true;
    try {
      await operacion();
      if (exito) this.mostrar(exito);
      return true;
    } catch (error) {
      if (!(error instanceof HttpErrorResponse)) throw error;
      if (error.status === 401) {
        this.store.cerrarSesion();
        void this.router.navigateByUrl('/login');
        this.mostrar('Tu sesión terminó. Vuelve a iniciar sesión.', 'error');
      } else {
        this.mostrar(mensajeDeError(error), 'error');
      }
      return false;
    } finally {
      this.enCurso = false;
    }
  }
}

export function mensajeDeError(error: HttpErrorResponse): string {
  if (error.status === 0) return 'No hay conexión con el servidor.';
  if (error.status === 403) return 'Tu rol no tiene permiso para esta acción.';
  return error.error?.detail ?? 'No se pudo completar la operación.';
}

// Componentes y utilidades de presentación compartidos, reutilizados del frontend Angular.

const NUMERO = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

/** Pesos colombianos. `corto` muestra millones: $22,2 M. */
export function cop(valor, formato) {
  if (formato === 'corto' && Math.abs(valor) >= 1_000_000) {
    return `$${DECIMAL.format(valor / 1_000_000)} M`;
  }
  return `$${NUMERO.format(valor)}`;
}

export function num(valor) {
  return NUMERO.format(valor);
}

/** Código de documento, p. ej. doc('OP', 3) -> 'OP-0003'. */
export function doc(prefijo, id) {
  if (id === null || id === undefined) return '—';
  return `${prefijo}-${String(id).padStart(4, '0')}`;
}

const ESTADOS = {
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

/** Etiqueta de estado: siempre lleva texto; el color solo refuerza. */
export function Estado({ valor }) {
  const [texto, tono] = ESTADOS[valor] ?? [valor, ''];
  const clase = `estado${tono ? ` ${tono}` : ''}`;
  return <span className={clase}>{texto}</span>;
}

export function Logo({ tam = 38 }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="2" y="6" width="40" height="40" rx="9" fill="#17599B" />
      <rect x="8" y="12" width="28" height="28" rx="6" fill="#3A74AD" />
      <path d="M14 26l8-7v4.5h9v5h-9V33z" fill="#BBD8F6" />
      <path
        d="M39 1L41.23 6.93L47.56 7.22L42.61 11.17L44.29 17.28L39 13.8L33.71 17.28L35.39 11.17L30.44 7.22L36.77 6.93Z"
        fill="#5AA5F0"
      />
    </svg>
  );
}

export function mensajeDeError(error) {
  if (error?.status === 0) return 'No hay conexión con el servidor.';
  if (error?.status === 403) return 'Tu rol no tiene permiso para esta acción.';
  return error?.detail ?? 'No se pudo completar la operación.';
}

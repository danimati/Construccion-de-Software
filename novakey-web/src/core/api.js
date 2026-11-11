// Cliente HTTP mínimo para la API de NovaKey. El token se guarda en sessionStorage
// (se pierde al cerrar la pestaña), igual que en el frontend original.

const CLAVE_TOKEN = 'novakey.token';

export function leerToken() {
  return sessionStorage.getItem(CLAVE_TOKEN);
}

export function guardarToken(token) {
  if (token) sessionStorage.setItem(CLAVE_TOKEN, token);
  else sessionStorage.removeItem(CLAVE_TOKEN);
}

/** Error con el estado HTTP y el mensaje `detail` (RFC 9457) devuelto por la API. */
export class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `Error ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

async function solicitar(metodo, ruta, cuerpo) {
  const cabeceras = {};
  const token = leerToken();
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';

  const resp = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });

  if (resp.status === 204) return null;

  let datos = null;
  const texto = await resp.text();
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
  }

  if (!resp.ok) {
    const detalle = datos && typeof datos === 'object' ? datos.detail : datos;
    throw new ApiError(resp.status, detalle);
  }
  return datos;
}

export const api = {
  get: (ruta) => solicitar('GET', ruta),
  post: (ruta, cuerpo) => solicitar('POST', ruta, cuerpo),
  put: (ruta, cuerpo) => solicitar('PUT', ruta, cuerpo),
};

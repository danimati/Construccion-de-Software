// Avisos (toasts) temporales. Reproduce el servicio Avisos del frontend original:
// una sola operación en curso a la vez, para que un doble clic no duplique documentos.

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ApiError } from '../core/api.js';
import { mensajeDeError } from './ui.jsx';

const AvisosContext = createContext(null);

export function ProveedorAvisos({ children, alExpirarSesion }) {
  const [aviso, setAviso] = useState(null);
  const temporizador = useRef(null);
  const enCurso = useRef(false);

  const mostrar = useCallback((texto, tipo = 'ok') => {
    setAviso({ texto, tipo });
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAviso(null), tipo === 'error' ? 7000 : 3500);
  }, []);

  const intentar = useCallback(
    async (operacion, exito) => {
      if (enCurso.current) return false;
      enCurso.current = true;
      try {
        await operacion();
        if (exito) mostrar(exito);
        return true;
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        if (error.status === 401) {
          alExpirarSesion?.();
          mostrar('Tu sesión terminó. Vuelve a iniciar sesión.', 'error');
        } else {
          mostrar(mensajeDeError(error), 'error');
        }
        return false;
      } finally {
        enCurso.current = false;
      }
    },
    [mostrar, alExpirarSesion]
  );

  return (
    <AvisosContext.Provider value={{ aviso, mostrar, intentar, limpiar: () => setAviso(null) }}>
      {children}
      {aviso && (
        <div className={`aviso${aviso.tipo === 'error' ? ' error' : ''}`} role="status">
          {aviso.texto}
        </div>
      )}
    </AvisosContext.Provider>
  );
}

export function useAvisos() {
  const ctx = useContext(AvisosContext);
  if (!ctx) throw new Error('useAvisos debe usarse dentro de ProveedorAvisos');
  return ctx;
}

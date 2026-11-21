// Contexto de sesión: inicio/cierre, usuario actual y comprobación de permisos.
// Reproduce las responsabilidades de autenticación del ErpStore del frontend original.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, guardarToken, leerToken } from './api.js';

const SesionContext = createContext(null);

export function ProveedorSesion({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al arrancar, si hay token guardado se recupera la sesión.
  useEffect(() => {
    let vivo = true;
    async function recuperar() {
      if (!leerToken()) {
        setCargando(false);
        return;
      }
      try {
        const yo = await api.get('/auth/me');
        if (vivo) setUsuario(yo);
      } catch {
        guardarToken(null);
      } finally {
        if (vivo) setCargando(false);
      }
    }
    recuperar();
    return () => {
      vivo = false;
    };
  }, []);

  const iniciarSesion = async (username, password) => {
    const login = await api.post('/auth/login', { username, password });
    guardarToken(login.token);
    setUsuario(login.usuario);
    return login.usuario;
  };

  const cerrarSesion = () => {
    guardarToken(null);
    setUsuario(null);
  };

  // Devuelve el nivel ('ver' | 'editar' | null) del usuario en un módulo.
  const nivel = (modulo) => usuario?.permisos?.[modulo] ?? null;
  const puede = (modulo) => nivel(modulo) !== null;
  const puedeEditar = (modulo) => nivel(modulo) === 'editar';

  const valor = { usuario, cargando, iniciarSesion, cerrarSesion, nivel, puede, puedeEditar };
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion() {
  const ctx = useContext(SesionContext);
  if (!ctx) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return ctx;
}

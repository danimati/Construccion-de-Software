// Hook sencillo para cargar un recurso de la API con estados de carga y error.

import { useEffect, useState } from 'react';
import { api } from './api.js';

export function useRecurso(ruta, { activo = true } = {}) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(activo);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!activo) {
      setCargando(false);
      return;
    }
    let vivo = true;
    setCargando(true);
    api
      .get(ruta)
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setError(e))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [ruta, activo]);

  return { datos, cargando, error };
}

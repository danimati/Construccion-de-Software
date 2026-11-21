import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../core/api.js';
import { MODULOS } from '../core/modulos.js';
import { useSesion } from '../core/sesion.jsx';
import { useAvisos } from '../shared/avisos.jsx';
import { Logo } from '../shared/ui.jsx';

// El menú oculta lo que un rol no puede usar, pero la protección real está en el servidor.
export default function Shell() {
  const { usuario, puede, cerrarSesion } = useSesion();
  const avisos = useAvisos();
  const navegar = useNavigate();

  const modulos = MODULOS.filter((m) => puede(m.id));

  // El botón de reinicio solo aparece si la API corre con el perfil demo.
  const [esDemo, setEsDemo] = useState(false);
  useEffect(() => {
    api
      .get('/demo/accesos')
      .then((a) => setEsDemo(Array.isArray(a) && a.length > 0))
      .catch(() => setEsDemo(false));
  }, []);

  const salir = () => {
    cerrarSesion();
    avisos.limpiar();
    navegar('/login');
  };

  const restablecer = () => {
    if (!confirm('Se perderán los cambios hechos en esta demostración. ¿Continuar?')) return;
    avisos.intentar(() => api.post('/demo/reiniciar'), 'Datos de ejemplo restablecidos.');
  };

  const claseItem = ({ isActive }) => `item${isActive ? ' activo' : ''}`;

  return (
    <div className="shell">
      <nav aria-label="Módulos del ERP">
        <NavLink className="marca" to="/panel">
          <Logo />
          <div>
            <strong>NovaKey</strong>
            <span>ERP interno</span>
          </div>
        </NavLink>
        <div className="items">
          <NavLink className={claseItem} to="/panel">
            <span className="cod" aria-hidden="true">
              ··
            </span>
            Panel general
          </NavLink>
          {modulos.map((m) => (
            <NavLink key={m.id} className={claseItem} to={m.ruta}>
              <span className="cod" aria-hidden="true">
                {m.codigo}
              </span>
              {m.etiqueta}
            </NavLink>
          ))}
        </div>
        <div className="pie">
          <span>{usuario?.nombre}</span>
          <small>{usuario?.roles?.join(', ')}</small>
          <button type="button" className="enlace" onClick={salir}>
            Cerrar sesión
          </button>
          {esDemo && (
            <button type="button" className="enlace" onClick={restablecer}>
              Restablecer datos de ejemplo
            </button>
          )}
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { MODULOS } from '../core/modulos.js';
import { useSesion } from '../core/sesion.jsx';

// Panel general: accesos rápidos a los módulos que permite el rol.
export default function Panel() {
  const { usuario, puede } = useSesion();
  const modulos = MODULOS.filter((m) => puede(m.id));

  return (
    <div className="pagina">
      <header className="cab">
        <div>
          <h1>Panel general</h1>
          <p>
            Hola, {usuario?.nombre}. Estos son los módulos disponibles para tu rol
            {usuario?.roles?.length ? ` (${usuario.roles.join(', ')})` : ''}.
          </p>
        </div>
      </header>

      {modulos.length === 0 ? (
        <p className="vacio">Tu rol aún no tiene módulos asignados.</p>
      ) : (
        <div className="kpis">
          {modulos.map((m) => (
            <Link key={m.id} className="kpi" to={m.ruta}>
              <span className="kpi-etq mono">{m.codigo}</span>
              <span className="kpi-valor" style={{ fontSize: 22 }}>
                {m.etiqueta}
              </span>
              <span className="kpi-nota">
                {usuario?.permisos?.[m.id] === 'editar'
                  ? 'Puedes consultar y editar'
                  : 'Solo consulta'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

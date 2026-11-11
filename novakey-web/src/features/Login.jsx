import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../core/api.js';
import { useSesion } from '../core/sesion.jsx';
import { Logo } from '../shared/ui.jsx';

export default function Login() {
  const { iniciarSesion } = useSesion();
  const navegar = useNavigate();

  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [accesosDemo, setAccesosDemo] = useState([]);

  // Carga los accesos de demostración (solo existen con el perfil demo de la API).
  useEffect(() => {
    api
      .get('/demo/accesos')
      .then(setAccesosDemo)
      .catch(() => setAccesosDemo([]));
  }, []);

  const usar = (u, p) => {
    setUsuario(u);
    setContrasena(p);
    setError('');
  };

  const entrar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await iniciarSesion(usuario, contrasena);
      navegar('/panel');
    } catch (e) {
      setError(
        e.status === 401 || e.status === 400
          ? 'Usuario o contraseña incorrectos.'
          : 'No se pudo iniciar sesión.'
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <section className="marca">
        <div className="logo">
          <Logo tam={56} />
          <div>
            <strong>NovaKey</strong>
            <span>teclados inteligentes</span>
          </div>
        </div>
        <div>
          <h1>Del componente al despacho, en un solo sistema.</h1>
          <p>
            Inventario, producción, compras, ventas y personal con la misma información para todas
            las áreas.
          </p>
        </div>
        <p className="pie">Universidad Distrital · Construcción de Software · Grupo 020-81</p>
      </section>

      <section className="acceso">
        <form onSubmit={entrar}>
          <div>
            <h2>Iniciar sesión</h2>
            <p className="suave">Verás los módulos que permite tu rol.</p>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <label className="campo">
            Usuario
            <input
              name="usuario"
              autoComplete="username"
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
          </label>
          <label className="campo">
            Contraseña
            <input
              name="contrasena"
              type="password"
              autoComplete="current-password"
              required
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-pri" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
          {accesosDemo.length > 0 && (
            <div className="demo">
              <p className="chico suave">Demostración: elige un rol para rellenar el acceso.</p>
              <div className="demo-botones">
                {accesosDemo.map((d) => (
                  <button
                    key={d.username}
                    type="button"
                    className="btn btn-chico"
                    onClick={() => usar(d.username, d.password)}
                  >
                    {d.rol}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}

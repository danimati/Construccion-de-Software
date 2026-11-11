import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useSesion } from './core/sesion.jsx';
import { ProveedorAvisos } from './shared/avisos.jsx';
import Shell from './layout/Shell.jsx';
import Login from './features/Login.jsx';
import Panel from './features/Panel.jsx';
import Inventario from './features/Inventario.jsx';
import Compras from './features/Compras.jsx';
import Ventas from './features/Ventas.jsx';
import RecursosHumanos from './features/RecursosHumanos.jsx';
import Produccion from './features/Produccion.jsx';
import Accesos from './features/Accesos.jsx';

// Protege las rutas internas: sin sesión, redirige al login.
function Privado({ children }) {
  const { usuario, cargando } = useSesion();
  if (cargando) return <p className="vacio">Cargando…</p>;
  if (!usuario) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();

  const alExpirarSesion = () => {
    cerrarSesion();
    navegar('/login');
  };

  return (
    <ProveedorAvisos alExpirarSesion={alExpirarSesion}>
      <Routes>
        <Route path="/login" element={usuario ? <Navigate to="/panel" replace /> : <Login />} />
        <Route
          element={
            <Privado>
              <Shell />
            </Privado>
          }
        >
          <Route path="/panel" element={<Panel />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/produccion" element={<Produccion />} />
          <Route path="/compras" element={<Compras />} />
          <Route path="/recursos-humanos" element={<RecursosHumanos />} />
          <Route path="/accesos" element={<Accesos />} />
        </Route>
        <Route path="*" element={<Navigate to="/panel" replace />} />
      </Routes>
    </ProveedorAvisos>
  );
}

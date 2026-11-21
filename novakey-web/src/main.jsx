import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { ProveedorSesion } from './core/sesion.jsx';
import './styles.css';

// Enrutado con # para poder servir dist/ desde cualquier servidor estático (igual que el original).
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <ProveedorSesion>
        <App />
      </ProveedorSesion>
    </HashRouter>
  </StrictMode>
);

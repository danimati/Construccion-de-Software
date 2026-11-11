import { useCallback, useEffect, useState } from 'react';
import { api } from '../core/api.js';
import { MODULOS } from '../core/modulos.js';
import { useSesion } from '../core/sesion.jsx';
import { useAvisos } from '../shared/avisos.jsx';
import Modal from '../shared/Modal.jsx';
import { Estado } from '../shared/ui.jsx';

const ROL_ADMIN_ID = 6;
const ETIQUETAS = { editar: 'Editar', ver: 'Ver', ninguno: 'Sin acceso' };

// Pantalla de Identidad y Accesos (RF01): matriz de permisos por rol y gestión de usuarios.
export default function Accesos() {
  const { usuario, puedeEditar } = useSesion();
  const avisos = useAvisos();
  const editable = puedeEditar('accesos');

  const [roles, setRoles] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [usuarioAbierto, setUsuarioAbierto] = useState(false);
  const vacio = { username: '', email: '', password: '', empleado_id: '', rol_id: 2 };
  const [nuevo, setNuevo] = useState(vacio);

  const cargar = useCallback(async () => {
    const [rs, us] = await Promise.all([api.get('/roles'), api.get('/usuarios')]);
    setRoles(rs);
    setUsuarios(us);
    // El resumen de empleados lo puede ver quien tiene accesos:ver.
    try {
      setEmpleados(await api.get('/empleados/resumen'));
    } catch {
      setEmpleados([]);
    }
  }, []);

  useEffect(() => {
    cargar().catch(() => avisos.mostrar('No se pudieron cargar los accesos.', 'error'));
  }, [cargar, avisos]);

  async function accion(fn, exito) {
    const ok = await avisos.intentar(fn, exito);
    if (ok) await cargar();
    return ok;
  }

  const bloqueado = (rol, modulo) => rol.id === ROL_ADMIN_ID && modulo === 'accesos';

  const nombreEmpleado = (u) => {
    const emp = empleados.find((x) => x.id === u.empleado_id);
    return emp ? `${emp.nombres} ${emp.apellidos}` : '—';
  };
  const nombreRol = (u) =>
    roles
      .filter((r) => u.rol_ids.includes(r.id))
      .map((r) => r.nombre)
      .join(', ');

  const empleadosLibres = empleados.filter((e) => !usuarios.some((u) => u.empleado_id === e.id));

  const fijarPermiso = (rolId, modulo, valor) =>
    accion(
      () => api.put(`/roles/${rolId}/permisos/${modulo}`, { nivel: valor === 'ninguno' ? null : valor }),
      'Permiso actualizado.'
    );
  const cambiarRol = (id, rolId) =>
    accion(() => api.put(`/usuarios/${id}/rol`, { rol_id: Number(rolId) }), 'Rol actualizado.');
  const alternar = (u) =>
    accion(() => api.put(`/usuarios/${u.id}/activo`, { activo: !u.activo }));

  async function crear(ev) {
    ev.preventDefault();
    const cuerpo = {
      username: nuevo.username,
      email: nuevo.email,
      password: nuevo.password,
      rol_id: Number(nuevo.rol_id),
      empleado_id: nuevo.empleado_id === '' ? null : Number(nuevo.empleado_id),
    };
    const ok = await accion(() => api.post('/usuarios', cuerpo), 'Usuario creado.');
    if (ok) {
      setUsuarioAbierto(false);
      setNuevo(vacio);
    }
  }

  return (
    <div className="pagina">
      <header className="cab">
        <div>
          <h1>Identidad y Accesos</h1>
          <p>Usuarios, roles y permisos por módulo.</p>
        </div>
        {editable && (
          <button type="button" className="btn btn-pri" onClick={() => setUsuarioAbierto(true)}>
            Nuevo usuario
          </button>
        )}
      </header>

      <section className="tarjeta tabla-caja">
        <h2>Permisos por rol</h2>
        <table>
          <thead>
            <tr>
              <th>Rol</th>
              {MODULOS.map((m) => (
                <th key={m.id}>{m.etiqueta}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="fuerte">{r.nombre}</span>
                  <br />
                  <small className="suave">{r.descripcion}</small>
                </td>
                {MODULOS.map((m) => (
                  <td key={m.id}>
                    {editable && !bloqueado(r, m.id) ? (
                      <select
                        className="control-chico"
                        aria-label={`${r.nombre} en ${m.etiqueta}`}
                        value={r.permisos[m.id] ?? 'ninguno'}
                        onChange={(e) => fijarPermiso(r.id, m.id, e.target.value)}
                      >
                        <option value="editar">Editar</option>
                        <option value="ver">Ver</option>
                        <option value="ninguno">Sin acceso</option>
                      </select>
                    ) : (
                      ETIQUETAS[r.permisos[m.id] ?? 'ninguno']
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="tarjeta tabla-caja">
        <h2>Usuarios</h2>
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Empleado</th>
              <th>Rol</th>
              <th>Estado</th>
              {editable && (
                <th>
                  <span className="sr">Acción</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="mono">{u.username}</td>
                <td>{nombreEmpleado(u)}</td>
                <td>
                  {editable && u.id !== usuario?.id ? (
                    <select
                      className="control-chico"
                      aria-label={`Rol de ${u.username}`}
                      value={u.rol_ids[0]}
                      onChange={(e) => cambiarRol(u.id, e.target.value)}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre}
                        </option>
                      ))}
                    </select>
                  ) : (
                    nombreRol(u)
                  )}
                </td>
                <td>
                  <Estado valor={u.activo ? 'activo' : 'inactivo'} />
                </td>
                {editable && (
                  <td className="der">
                    {u.id !== usuario?.id && (
                      <button type="button" className="btn btn-chico" onClick={() => alternar(u)}>
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Modal titulo="Nuevo usuario" abierto={usuarioAbierto} onCerrar={() => setUsuarioAbierto(false)}>
        <form className="form" onSubmit={crear}>
          <div className="form-2">
            <label className="campo">
              Usuario
              <input
                autoComplete="off"
                value={nuevo.username}
                onChange={(e) => setNuevo({ ...nuevo, username: e.target.value })}
              />
            </label>
            <label className="campo">
              Correo
              <input
                type="email"
                autoComplete="off"
                value={nuevo.email}
                onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
              />
            </label>
            <label className="campo">
              Contraseña inicial
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={nuevo.password}
                onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
              />
            </label>
            <label className="campo">
              Empleado
              <select
                value={nuevo.empleado_id}
                onChange={(e) => setNuevo({ ...nuevo, empleado_id: e.target.value })}
              >
                <option value="">Sin empleado asociado</option>
                {empleadosLibres.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombres} {emp.apellidos}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              Rol
              <select
                value={nuevo.rol_id}
                onChange={(e) => setNuevo({ ...nuevo, rol_id: e.target.value })}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-pie">
            <span />
            <button type="submit" className="btn btn-pri">
              Guardar usuario
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

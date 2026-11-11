import { useCallback, useEffect, useState } from 'react';
import { api } from '../core/api.js';
import { useSesion } from '../core/sesion.jsx';
import { useAvisos } from '../shared/avisos.jsx';
import Modal from '../shared/Modal.jsx';
import { cop, doc, Estado } from '../shared/ui.jsx';

// Pantalla de Recursos Humanos (RF05): empleados, cargos y nóminas.
export default function RecursosHumanos() {
  const { puedeEditar } = useSesion();
  const avisos = useAvisos();
  const editable = puedeEditar('rh');

  const [empleados, setEmpleados] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [nominas, setNominas] = useState([]);
  const [empAbierto, setEmpAbierto] = useState(false);

  const empVacio = {
    cargo_id: '',
    documento: '',
    nombres: '',
    apellidos: '',
    email: '',
    telefono: '',
    fecha_ingreso: '',
    hora_inicio: '08:00',
    hora_fin: '17:00',
  };
  const [emp, setEmp] = useState(empVacio);

  const cargar = useCallback(async () => {
    const [emps, cgs, noms] = await Promise.all([
      api.get('/empleados'),
      api.get('/cargos'),
      api.get('/nominas'),
    ]);
    setEmpleados(emps);
    setCargos(cgs);
    setNominas(noms);
  }, []);

  useEffect(() => {
    cargar().catch(() => avisos.mostrar('No se pudo cargar Recursos Humanos.', 'error'));
  }, [cargar, avisos]);

  async function accion(fn, exito) {
    const ok = await avisos.intentar(fn, exito);
    if (ok) await cargar();
    return ok;
  }

  const nombreCargo = (id) => cargos.find((c) => c.id === id)?.nombre ?? `Cargo ${id}`;

  async function crearEmpleado(ev) {
    ev.preventDefault();
    const cuerpo = { ...emp, cargo_id: Number(emp.cargo_id) };
    if (await accion(() => api.post('/empleados', cuerpo), 'Empleado creado con su horario.')) {
      setEmpAbierto(false);
      setEmp(empVacio);
    }
  }

  const cambiarEstado = (id, estado) =>
    accion(() => api.put(`/empleados/${id}/estado`, { estado }), 'Estado actualizado.');
  const generarNomina = () =>
    accion(() => api.post('/nominas'), 'Nómina generada en borrador.');
  const pagarNomina = (id) =>
    accion(() => api.post(`/nominas/${id}/pagar`), 'Nómina pagada.');

  function editarDevengados(nomina, detalle) {
    const valor = prompt(
      `Devengados para el empleado ${detalle.empleado_id} (actual ${detalle.devengados}):`,
      detalle.devengados
    );
    if (valor === null) return;
    accion(
      () => api.put(`/nominas/${nomina.id}/detalles/${detalle.id}/devengados`, { devengados: Number(valor) }),
      'Devengados actualizados.'
    );
  }

  return (
    <div className="pagina">
      <header className="cab">
        <div>
          <h1>Recursos Humanos</h1>
          <p>Expedientes del personal, cargos y nóminas.</p>
        </div>
        {editable && (
          <div className="acciones">
            <button type="button" className="btn" onClick={generarNomina}>
              Generar nómina
            </button>
            <button type="button" className="btn btn-pri" onClick={() => setEmpAbierto(true)}>
              Nuevo empleado
            </button>
          </div>
        )}
      </header>

      <section className="tarjeta tabla-caja">
        <h2>Empleados</h2>
        <table>
          <thead>
            <tr>
              <th>Documento</th>
              <th>Nombre</th>
              <th>Cargo</th>
              <th>Estado</th>
              {editable && (
                <th>
                  <span className="sr">Acción</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {empleados.map((e) => (
              <tr key={e.id}>
                <td className="mono">{e.documento}</td>
                <td>
                  {e.nombres} {e.apellidos}
                </td>
                <td className="suave">{nombreCargo(e.cargo_id)}</td>
                <td>
                  {editable ? (
                    <select
                      className="control-chico"
                      aria-label={`Estado de ${e.nombres}`}
                      value={e.estado}
                      onChange={(ev) => cambiarEstado(e.id, ev.target.value)}
                    >
                      <option value="activo">Activo</option>
                      <option value="vacaciones">Vacaciones</option>
                      <option value="retirado">Retirado</option>
                    </select>
                  ) : (
                    <Estado valor={e.estado} />
                  )}
                </td>
                {editable && <td />}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="tarjeta">
        <h2>Nóminas</h2>
        {nominas.length === 0 ? (
          <p className="vacio">Sin nóminas generadas.</p>
        ) : (
          nominas.map((n) => {
            const neto = n.detalles.reduce((s, d) => s + Number(d.neto_pagar), 0);
            return (
              <div key={n.id} className="tarjeta" style={{ marginTop: 12 }}>
                <div className="cab">
                  <div>
                    <span className="fuerte mono">{doc('NOM', n.id)}</span>{' '}
                    <span className="suave">
                      {n.periodo_inicio} — {n.periodo_fin}
                    </span>{' '}
                    <Estado valor={n.estado} />
                  </div>
                  <div className="acciones">
                    <span className="fuerte">{cop(neto)}</span>
                    {editable && n.estado === 'borrador' && (
                      <button type="button" className="btn btn-chico btn-pri" onClick={() => pagarNomina(n.id)}>
                        Pagar nómina
                      </button>
                    )}
                  </div>
                </div>
                <div className="tabla-caja" style={{ marginTop: 10 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Empleado</th>
                        <th className="der">Salario base</th>
                        <th className="der">Devengados</th>
                        <th className="der">Deducciones</th>
                        <th className="der">Neto</th>
                        {editable && n.estado === 'borrador' && (
                          <th>
                            <span className="sr">Acción</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {n.detalles.map((d) => (
                        <tr key={d.id}>
                          <td>#{d.empleado_id}</td>
                          <td className="der">{cop(Number(d.salario_base))}</td>
                          <td className="der">{cop(Number(d.devengados))}</td>
                          <td className="der suave">{cop(Number(d.deducciones))}</td>
                          <td className="der fuerte">{cop(Number(d.neto_pagar))}</td>
                          {editable && n.estado === 'borrador' && (
                            <td className="der">
                              <button
                                type="button"
                                className="btn btn-chico"
                                onClick={() => editarDevengados(n, d)}
                              >
                                Devengados
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </section>

      <Modal titulo="Nuevo empleado" abierto={empAbierto} onCerrar={() => setEmpAbierto(false)}>
        <form className="form" onSubmit={crearEmpleado}>
          <div className="form-2">
            <label className="campo">
              Cargo
              <select
                value={emp.cargo_id}
                onChange={(e) => setEmp({ ...emp, cargo_id: e.target.value })}
                required
              >
                <option value="">Selecciona…</option>
                {cargos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              Documento
              <input value={emp.documento} onChange={(e) => setEmp({ ...emp, documento: e.target.value })} required />
            </label>
            <label className="campo">
              Nombres
              <input value={emp.nombres} onChange={(e) => setEmp({ ...emp, nombres: e.target.value })} required />
            </label>
            <label className="campo">
              Apellidos
              <input value={emp.apellidos} onChange={(e) => setEmp({ ...emp, apellidos: e.target.value })} required />
            </label>
            <label className="campo">
              Fecha de ingreso
              <input
                type="date"
                value={emp.fecha_ingreso}
                onChange={(e) => setEmp({ ...emp, fecha_ingreso: e.target.value })}
                required
              />
            </label>
            <label className="campo">
              Correo
              <input value={emp.email} onChange={(e) => setEmp({ ...emp, email: e.target.value })} />
            </label>
            <label className="campo">
              Hora de entrada
              <input
                type="time"
                value={emp.hora_inicio}
                onChange={(e) => setEmp({ ...emp, hora_inicio: e.target.value })}
                required
              />
            </label>
            <label className="campo">
              Hora de salida
              <input
                type="time"
                value={emp.hora_fin}
                onChange={(e) => setEmp({ ...emp, hora_fin: e.target.value })}
                required
              />
            </label>
          </div>
          <div className="form-pie">
            <span />
            <button type="submit" className="btn btn-pri">
              Guardar empleado
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

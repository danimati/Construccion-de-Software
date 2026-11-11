import { useRecurso } from '../core/useRecurso.js';
import { cop, doc, Estado } from '../shared/ui.jsx';

// Pantalla de Recursos Humanos (RF05): empleados y nóminas.
export default function RecursosHumanos() {
  const empleados = useRecurso('/empleados');
  const cargos = useRecurso('/cargos');
  const nominas = useRecurso('/nominas');

  const nombreCargo = (id) => cargos.datos?.find((c) => c.id === id)?.nombre ?? `Cargo ${id}`;

  return (
    <div className="pagina">
      <header className="cab">
        <div>
          <h1>Recursos Humanos</h1>
          <p>Expedientes del personal, cargos y nóminas.</p>
        </div>
      </header>

      <section className="tarjeta">
        <h2>Empleados</h2>
        {empleados.cargando ? (
          <p className="vacio">Cargando…</p>
        ) : empleados.error ? (
          <p className="vacio">No se pudieron cargar los empleados.</p>
        ) : (
          <div className="tabla-caja">
            <table>
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Nombre</th>
                  <th>Cargo</th>
                  <th>Ingreso</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {(empleados.datos ?? []).map((emp) => (
                  <tr key={emp.id}>
                    <td className="mono">{emp.documento}</td>
                    <td>
                      {emp.nombres} {emp.apellidos}
                    </td>
                    <td className="suave">{nombreCargo(emp.cargo_id)}</td>
                    <td className="suave">{emp.fecha_ingreso}</td>
                    <td>
                      <Estado valor={emp.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta">
        <h2>Nóminas</h2>
        {nominas.cargando ? (
          <p className="vacio">Cargando…</p>
        ) : (nominas.datos ?? []).length === 0 ? (
          <p className="vacio">Sin nóminas generadas.</p>
        ) : (
          <div className="tabla-caja">
            <table>
              <thead>
                <tr>
                  <th>Nómina</th>
                  <th>Periodo</th>
                  <th className="der">Empleados</th>
                  <th className="der">Neto total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {nominas.datos.map((n) => {
                  const neto = n.detalles.reduce((s, d) => s + Number(d.neto_pagar), 0);
                  return (
                    <tr key={n.id}>
                      <td className="mono">{doc('NOM', n.id)}</td>
                      <td className="suave">
                        {n.periodo_inicio} — {n.periodo_fin}
                      </td>
                      <td className="der">{n.detalles.length}</td>
                      <td className="der">{cop(neto)}</td>
                      <td>
                        <Estado valor={n.estado} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

import { useRecurso } from '../core/useRecurso.js';
import { cop, doc, Estado } from '../shared/ui.jsx';

// Pantalla de ventas (RF04): clientes, cotizaciones, pedidos y facturas.
export default function Ventas() {
  const clientes = useRecurso('/clientes');
  const cotizaciones = useRecurso('/cotizaciones');
  const pedidos = useRecurso('/pedidos');
  const facturas = useRecurso('/facturas');

  const nombreCliente = (id) =>
    clientes.datos?.find((c) => c.id === id)?.nombre ?? `Cliente ${id}`;

  return (
    <div className="pagina">
      <header className="cab">
        <div>
          <h1>Ventas (CRM)</h1>
          <p>Clientes corporativos, cotizaciones, pedidos y facturación.</p>
        </div>
      </header>

      <div className="columnas">
        <section className="tarjeta">
          <h2>Cotizaciones</h2>
          {cotizaciones.cargando ? (
            <p className="vacio">Cargando…</p>
          ) : (cotizaciones.datos ?? []).length === 0 ? (
            <p className="vacio">Sin cotizaciones.</p>
          ) : (
            <div className="tabla-caja">
              <table>
                <thead>
                  <tr>
                    <th>Cotización</th>
                    <th>Cliente</th>
                    <th className="der">Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cotizaciones.datos.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">{doc('COT', c.id)}</td>
                      <td>{nombreCliente(c.cliente_id)}</td>
                      <td className="der">{cop(Number(c.total))}</td>
                      <td>
                        <Estado valor={c.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="tarjeta">
          <h2>Pedidos</h2>
          {pedidos.cargando ? (
            <p className="vacio">Cargando…</p>
          ) : (pedidos.datos ?? []).length === 0 ? (
            <p className="vacio">Sin pedidos.</p>
          ) : (
            <div className="tabla-caja">
              <table>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Canal</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.datos.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{doc('PED', p.id)}</td>
                      <td>{nombreCliente(p.cliente_id)}</td>
                      <td className="suave">{p.canal}</td>
                      <td>
                        <Estado valor={p.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="tarjeta">
        <h2>Facturas</h2>
        {facturas.cargando ? (
          <p className="vacio">Cargando…</p>
        ) : (facturas.datos ?? []).length === 0 ? (
          <p className="vacio">Sin facturas emitidas.</p>
        ) : (
          <div className="tabla-caja">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Pedido</th>
                  <th className="der">Subtotal</th>
                  <th className="der">IVA</th>
                  <th className="der">Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {facturas.datos.map((f) => (
                  <tr key={f.id}>
                    <td className="mono">{f.numero}</td>
                    <td className="mono">{doc('PED', f.pedido_id)}</td>
                    <td className="der">{cop(Number(f.subtotal))}</td>
                    <td className="der suave">{cop(Number(f.impuestos))}</td>
                    <td className="der fuerte">{cop(Number(f.total))}</td>
                    <td>
                      <Estado valor={f.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

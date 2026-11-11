import { useRecurso } from '../core/useRecurso.js';
import { cop, doc, Estado, num } from '../shared/ui.jsx';

// Pantalla de compras (RF03): proveedores, órdenes de compra y cuentas por pagar.
export default function Compras() {
  const proveedores = useRecurso('/proveedores');
  const ordenes = useRecurso('/ordenes-compra');
  const cuentas = useRecurso('/cuentas-por-pagar');

  const nombreProveedor = (id) =>
    proveedores.datos?.find((p) => p.id === id)?.razon_social ?? `Proveedor ${id}`;

  return (
    <div className="pagina">
      <header className="cab">
        <div>
          <h1>Compras</h1>
          <p>Proveedores, órdenes de compra y cuentas por pagar.</p>
        </div>
      </header>

      <section className="tarjeta">
        <h2>Órdenes de compra</h2>
        {ordenes.cargando ? (
          <p className="vacio">Cargando…</p>
        ) : ordenes.error ? (
          <p className="vacio">No se pudieron cargar las órdenes.</p>
        ) : (ordenes.datos ?? []).length === 0 ? (
          <p className="vacio">Sin órdenes de compra.</p>
        ) : (
          <div className="tabla-caja">
            <table>
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Proveedor</th>
                  <th>Fecha</th>
                  <th className="der">Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.datos.map((o) => (
                  <tr key={o.id}>
                    <td className="mono">{doc('OC', o.id)}</td>
                    <td>{nombreProveedor(o.proveedor_id)}</td>
                    <td className="suave">{o.fecha}</td>
                    <td className="der">{cop(Number(o.total))}</td>
                    <td>
                      <Estado valor={o.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="columnas">
        <section className="tarjeta">
          <h2>Cuentas por pagar</h2>
          {cuentas.cargando ? (
            <p className="vacio">Cargando…</p>
          ) : (cuentas.datos ?? []).length === 0 ? (
            <p className="vacio">Sin cuentas por pagar.</p>
          ) : (
            <div className="tabla-caja">
              <table>
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th className="der">Monto</th>
                    <th className="der">Saldo</th>
                    <th>Vence</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.datos.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">{doc('OC', c.orden_compra_id)}</td>
                      <td className="der">{cop(Number(c.monto))}</td>
                      <td className="der">{cop(Number(c.saldo))}</td>
                      <td className="suave">{c.fecha_vencimiento}</td>
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
          <h2>Proveedores</h2>
          {proveedores.cargando ? (
            <p className="vacio">Cargando…</p>
          ) : (
            <ul className="lista">
              {(proveedores.datos ?? []).map((p) => (
                <li key={p.id}>
                  <div className="fuerte">{p.razon_social}</div>
                  <div className="chico suave mono">
                    NIT {p.nit}
                    {p.contacto ? ` · ${p.contacto}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="chico suave">
        {num((proveedores.datos ?? []).length)} proveedores registrados.
      </p>
    </div>
  );
}

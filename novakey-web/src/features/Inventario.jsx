import { useRecurso } from '../core/useRecurso.js';
import { Estado } from '../shared/ui.jsx';
import { cop, num } from '../shared/ui.jsx';

// Pantalla de inventario (RF02): materiales y productos con sus existencias.
export default function Inventario() {
  const materiales = useRecurso('/materiales');
  const productos = useRecurso('/productos');

  return (
    <div className="pagina">
      <header className="cab">
        <div>
          <h1>Inventario</h1>
          <p>Materias primas y productos terminados con sus existencias actuales.</p>
        </div>
      </header>

      <div className="columnas">
        <section className="tarjeta">
          <h2>Materiales</h2>
          {materiales.cargando ? (
            <p className="vacio">Cargando…</p>
          ) : materiales.error ? (
            <p className="vacio">No se pudieron cargar los materiales.</p>
          ) : (
            <div className="tabla-caja">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Material</th>
                    <th className="der">Stock</th>
                    <th className="der">Mínimo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(materiales.datos ?? []).map((m) => {
                    const bajo = Number(m.stock_actual) < Number(m.stock_minimo);
                    return (
                      <tr key={m.id}>
                        <td className="mono">{m.codigo}</td>
                        <td>{m.nombre}</td>
                        <td className="der">
                          {num(Number(m.stock_actual))} {m.unidad_medida}
                        </td>
                        <td className="der suave">{num(Number(m.stock_minimo))}</td>
                        <td>
                          <Estado valor={bajo ? 'bajo_minimo' : 'disponible'} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="tarjeta">
          <h2>Productos terminados</h2>
          {productos.cargando ? (
            <p className="vacio">Cargando…</p>
          ) : productos.error ? (
            <p className="vacio">No se pudieron cargar los productos.</p>
          ) : (
            <div className="tabla-caja">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Producto</th>
                    <th className="der">Precio</th>
                    <th className="der">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {(productos.datos ?? []).map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{p.sku}</td>
                      <td>{p.nombre}</td>
                      <td className="der">{cop(Number(p.precio_venta))}</td>
                      <td className="der">{num(p.stock_actual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

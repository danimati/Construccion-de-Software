import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../core/api.js';
import { ESTACIONES } from '../core/modulos.js';
import { useSesion } from '../core/sesion.jsx';
import { useAvisos } from '../shared/avisos.jsx';
import Modal from '../shared/Modal.jsx';
import { doc, Estado, num } from '../shared/ui.jsx';

const ESTACION_CALIDAD = 4; // índice 0..5; 4 = Control de calidad

// Pantalla de Producción (RF02): órdenes, recorrido por las 6 estaciones y trazabilidad.
export default function Produccion() {
  const { puedeEditar } = useSesion();
  const avisos = useAvisos();
  const editable = puedeEditar('produccion');

  const [ordenes, setOrdenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [seleccionId, setSeleccionId] = useState(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [form, setForm] = useState({ producto_id: 1, cantidad: 10 });

  const cargar = useCallback(async () => {
    const [ords, prods, unis] = await Promise.all([
      api.get('/ordenes-produccion'),
      api.get('/productos'),
      api.get('/unidades'),
    ]);
    setOrdenes(ords);
    setProductos(prods);
    setUnidades(unis);
  }, []);

  useEffect(() => {
    cargar().catch(() => avisos.mostrar('No se pudo cargar producción.', 'error'));
  }, [cargar, avisos]);

  const seleccion = useMemo(() => {
    if (ordenes.length === 0) return null;
    return (
      ordenes.find((o) => o.id === seleccionId) ??
      ordenes.find((o) => o.estado === 'en_proceso') ??
      ordenes[0]
    );
  }, [ordenes, seleccionId]);

  const nombreProducto = (id) => productos.find((p) => p.id === id)?.nombre ?? '—';

  const aprobadasDe = (ordenId) =>
    unidades.filter((u) => u.orden_produccion_id === ordenId && u.resultado_calidad === 'aprobada')
      .length;

  const unidadesSeleccion = useMemo(
    () =>
      unidades
        .filter((u) => u.orden_produccion_id === seleccion?.id)
        .sort((a, b) => b.id - a.id),
    [unidades, seleccion]
  );

  async function accion(fn, exito) {
    const ok = await avisos.intentar(fn, exito);
    if (ok) await cargar();
    return ok;
  }

  const iniciar = (id) =>
    accion(() => api.post(`/ordenes-produccion/${id}/iniciar`), `${doc('OP', id)} iniciada.`).then(
      () => setSeleccionId(id)
    );
  const cancelar = (id) =>
    accion(() => api.post(`/ordenes-produccion/${id}/cancelar`), `${doc('OP', id)} cancelada.`);
  const avanzar = (id, estacion, resultado) =>
    accion(() =>
      api.post(`/ordenes-produccion/${id}/avance`, { estacion, resultado })
    );

  async function crear(ev) {
    ev.preventDefault();
    let nuevoId = null;
    const ok = await avisos.intentar(async () => {
      const o = await api.post('/ordenes-produccion', {
        producto_id: Number(form.producto_id),
        cantidad: Number(form.cantidad),
      });
      nuevoId = o.id;
    }, 'Orden creada. Iníciala para consumir el material.');
    if (ok) {
      setNuevaAbierta(false);
      await cargar();
      setSeleccionId(nuevoId);
    }
  }

  // Límite de unidades que pueden avanzar a una estación (la anterior, o las aprobadas en empaque).
  const limiteEstacion = (o, i) => (i === 5 ? aprobadasDe(o.id) : o.avance[i - 1]);
  const pendiente = (o, i) => o.avance[i] < limiteEstacion(o, i);

  return (
    <div className="pagina">
      <header className="cab">
        <div>
          <h1>Producción</h1>
          <p>Órdenes de ensamblaje, consumo de materiales y trazabilidad por unidad.</p>
        </div>
        {editable && (
          <button type="button" className="btn btn-pri" onClick={() => setNuevaAbierta(true)}>
            Nueva orden
          </button>
        )}
      </header>

      <section className="tarjeta tabla-caja">
        <h2>Órdenes de producción</h2>
        <table>
          <thead>
            <tr>
              <th>Orden</th>
              <th>Producto</th>
              <th className="der">Cantidad</th>
              <th>Estado</th>
              <th>
                <span className="sr">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ordenes.map((o) => (
              <tr key={o.id} className={o.id === seleccion?.id ? 'fila-sel' : undefined}>
                <td className="mono">{doc('OP', o.id)}</td>
                <td>{nombreProducto(o.producto_id)}</td>
                <td className="der fuerte">{num(o.cantidad)}</td>
                <td>
                  <Estado valor={o.estado} />
                </td>
                <td className="der">
                  <span className="grupo-btn">
                    {o.estado === 'planeada' && editable && (
                      <>
                        <button
                          type="button"
                          className="btn btn-chico btn-pri"
                          onClick={() => iniciar(o.id)}
                        >
                          Iniciar
                        </button>
                        <button
                          type="button"
                          className="btn btn-chico"
                          onClick={() => cancelar(o.id)}
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn btn-chico"
                      onClick={() => setSeleccionId(o.id)}
                    >
                      Ver detalle
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {seleccion && (
        <>
          <section className="tarjeta">
            <h2>
              {doc('OP', seleccion.id)} · recorrido en la línea
            </h2>
            <p className="chico suave" style={{ marginBottom: 14 }}>
              Unidades que han superado cada estación, de {seleccion.cantidad} planeadas.
            </p>
            <ol className="estaciones">
              {ESTACIONES.map((nombre, i) => (
                <li key={nombre} className="estacion chico">
                  <span className="estacion-nombre">
                    {i + 1}. {nombre}
                  </span>
                  <span className="barra" aria-hidden="true">
                    <span style={{ width: `${(seleccion.avance[i] / seleccion.cantidad) * 100}%` }} />
                  </span>
                  <span className="suave">
                    {seleccion.avance[i]} de{' '}
                    {i === 5 ? `${aprobadasDe(seleccion.id)} aprobadas` : seleccion.cantidad}
                  </span>
                  {seleccion.estado === 'en_proceso' && editable && i > 0 && (
                    i === ESTACION_CALIDAD ? (
                      <span className="grupo-btn" style={{ justifyContent: 'flex-start' }}>
                        <button
                          type="button"
                          className="btn btn-chico"
                          disabled={!pendiente(seleccion, i)}
                          onClick={() => avanzar(seleccion.id, i, 'aprobada')}
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          className="btn btn-chico"
                          disabled={!pendiente(seleccion, i)}
                          onClick={() => avanzar(seleccion.id, i, 'rechazada')}
                        >
                          Rechazar
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-chico"
                        disabled={!pendiente(seleccion, i)}
                        onClick={() => avanzar(seleccion.id, i)}
                        aria-label={`Registrar una unidad en ${nombre}`}
                      >
                        +1 unidad
                      </button>
                    )
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section className="tarjeta tabla-caja">
            <h2>Unidades producidas</h2>
            {unidadesSeleccion.length === 0 ? (
              <p className="vacio">Sin unidades: se asignan en control de calidad.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Número de serie</th>
                    <th>Calidad</th>
                  </tr>
                </thead>
                <tbody>
                  {unidadesSeleccion.map((u) => (
                    <tr key={u.id}>
                      <td className="mono">{u.numero_serie}</td>
                      <td>
                        <Estado valor={u.resultado_calidad} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      <Modal
        titulo="Nueva orden de producción"
        abierto={nuevaAbierta}
        onCerrar={() => setNuevaAbierta(false)}
      >
        <form className="form" onSubmit={crear}>
          <label className="campo">
            Producto
            <select
              value={form.producto_id}
              onChange={(e) => setForm({ ...form, producto_id: e.target.value })}
            >
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Cantidad
            <input
              type="number"
              min="1"
              step="1"
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
            />
          </label>
          <div className="form-pie">
            <span />
            <button type="submit" className="btn btn-pri">
              Crear orden
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

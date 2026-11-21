import { useCallback, useEffect, useState } from 'react';
import { api } from '../core/api.js';
import { useSesion } from '../core/sesion.jsx';
import { useAvisos } from '../shared/avisos.jsx';
import Modal from '../shared/Modal.jsx';
import { cop, Estado, num } from '../shared/ui.jsx';

// Pantalla de inventario (RF02): materiales y productos con ajuste de existencias.
export default function Inventario() {
  const { puedeEditar } = useSesion();
  const avisos = useAvisos();
  const editable = puedeEditar('inventario');

  const [materiales, setMateriales] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ajusteAbierto, setAjusteAbierto] = useState(false);
  const vacio = { tipo: 'material', material_id: '', producto_id: '', cantidad: '', motivo: '' };
  const [form, setForm] = useState(vacio);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [mats, prods] = await Promise.all([api.get('/materiales'), api.get('/productos')]);
      setMateriales(mats);
      setProductos(prods);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar().catch(() => avisos.mostrar('No se pudo cargar el inventario.', 'error'));
  }, [cargar, avisos]);

  async function ajustar(ev) {
    ev.preventDefault();
    const cuerpo = {
      cantidad: Number(form.cantidad),
      motivo: form.motivo,
      material_id: form.tipo === 'material' ? Number(form.material_id) : null,
      producto_id: form.tipo === 'producto' ? Number(form.producto_id) : null,
    };
    const ok = await avisos.intentar(
      () => api.post('/movimientos/ajustes', cuerpo),
      'Ajuste registrado.'
    );
    if (ok) {
      setAjusteAbierto(false);
      setForm(vacio);
      await cargar();
    }
  }

  return (
    <div className="pagina">
      <header className="cab">
        <div>
          <h1>Inventario</h1>
          <p>Materias primas y productos terminados con sus existencias actuales.</p>
        </div>
        {editable && (
          <button type="button" className="btn btn-pri" onClick={() => setAjusteAbierto(true)}>
            Ajustar existencias
          </button>
        )}
      </header>

      {cargando ? (
        <p className="vacio">Cargando…</p>
      ) : (
        <div className="columnas">
          <section className="tarjeta">
            <h2>Materiales</h2>
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
                  {materiales.map((m) => {
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
          </section>

          <section className="tarjeta">
            <h2>Productos terminados</h2>
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
                  {productos.map((p) => (
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
          </section>
        </div>
      )}

      <Modal titulo="Ajustar existencias" abierto={ajusteAbierto} onCerrar={() => setAjusteAbierto(false)}>
        <form className="form" onSubmit={ajustar}>
          <label className="campo">
            Tipo
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="material">Material</option>
              <option value="producto">Producto</option>
            </select>
          </label>
          {form.tipo === 'material' ? (
            <label className="campo">
              Material
              <select
                value={form.material_id}
                onChange={(e) => setForm({ ...form, material_id: e.target.value })}
                required
              >
                <option value="">Selecciona…</option>
                {materiales.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="campo">
              Producto
              <select
                value={form.producto_id}
                onChange={(e) => setForm({ ...form, producto_id: e.target.value })}
                required
              >
                <option value="">Selecciona…</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="campo">
            Cantidad (negativa para descontar)
            <input
              type="number"
              step="any"
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
              required
            />
          </label>
          <label className="campo">
            Motivo
            <input
              maxLength={40}
              value={form.motivo}
              onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              required
            />
          </label>
          <div className="form-pie">
            <span />
            <button type="submit" className="btn btn-pri">
              Registrar ajuste
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

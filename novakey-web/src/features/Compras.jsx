import { useCallback, useEffect, useState } from 'react';
import { api } from '../core/api.js';
import { useSesion } from '../core/sesion.jsx';
import { useAvisos } from '../shared/avisos.jsx';
import Modal from '../shared/Modal.jsx';
import { cop, doc, Estado } from '../shared/ui.jsx';

// Pantalla de compras (RF03): proveedores, órdenes de compra, recepciones y cuentas por pagar.
export default function Compras() {
  const { puedeEditar } = useSesion();
  const avisos = useAvisos();
  const editable = puedeEditar('compras');

  const [proveedores, setProveedores] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [materiales, setMateriales] = useState([]);

  const [provAbierto, setProvAbierto] = useState(false);
  const [ordenAbierta, setOrdenAbierta] = useState(false);
  const [recepcion, setRecepcion] = useState(null); // orden en recepción

  const provVacio = { nit: '', razon_social: '', contacto: '', email: '', telefono: '' };
  const [prov, setProv] = useState(provVacio);
  const [orden, setOrden] = useState({ proveedor_id: '', lineas: [vaciaLinea()] });
  const [recibidas, setRecibidas] = useState({});

  function vaciaLinea() {
    return { material_id: '', cantidad: '', precio_unitario: '' };
  }

  const cargar = useCallback(async () => {
    const [ps, os, cs, ms] = await Promise.all([
      api.get('/proveedores'),
      api.get('/ordenes-compra'),
      api.get('/cuentas-por-pagar'),
      api.get('/materiales'),
    ]);
    setProveedores(ps);
    setOrdenes(os);
    setCuentas(cs);
    setMateriales(ms);
  }, []);

  useEffect(() => {
    cargar().catch(() => avisos.mostrar('No se pudieron cargar las compras.', 'error'));
  }, [cargar, avisos]);

  async function accion(fn, exito) {
    const ok = await avisos.intentar(fn, exito);
    if (ok) await cargar();
    return ok;
  }

  const nombreProveedor = (id) =>
    proveedores.find((p) => p.id === id)?.razon_social ?? `Proveedor ${id}`;
  const nombreMaterial = (id) => materiales.find((m) => m.id === id)?.nombre ?? `#${id}`;

  async function crearProveedor(ev) {
    ev.preventDefault();
    if (await accion(() => api.post('/proveedores', prov), 'Proveedor creado.')) {
      setProvAbierto(false);
      setProv(provVacio);
    }
  }

  async function crearOrden(ev) {
    ev.preventDefault();
    const cuerpo = {
      proveedor_id: Number(orden.proveedor_id),
      lineas: orden.lineas.map((l) => ({
        material_id: Number(l.material_id),
        cantidad: Number(l.cantidad),
        precio_unitario: Number(l.precio_unitario),
      })),
    };
    if (await accion(() => api.post('/ordenes-compra', cuerpo), 'Orden de compra creada.')) {
      setOrdenAbierta(false);
      setOrden({ proveedor_id: '', lineas: [vaciaLinea()] });
    }
  }

  async function recibir(ev) {
    ev.preventDefault();
    const cantidades = {};
    for (const [id, v] of Object.entries(recibidas)) {
      if (v !== '' && Number(v) > 0) cantidades[id] = Number(v);
    }
    if (Object.keys(cantidades).length === 0) {
      avisos.mostrar('Indica al menos una cantidad recibida.', 'error');
      return;
    }
    if (await accion(() => api.post(`/ordenes-compra/${recepcion.id}/recepciones`, { cantidades }), 'Recepción registrada.')) {
      setRecepcion(null);
      setRecibidas({});
    }
  }

  function pagar(cuenta) {
    const monto = prompt(`Monto a pagar (saldo ${cuenta.saldo}):`, cuenta.saldo);
    if (monto === null) return;
    accion(() => api.post(`/cuentas-por-pagar/${cuenta.id}/pagos`, { monto: Number(monto) }), 'Pago registrado.');
  }

  const setLinea = (i, campo, valor) => {
    const lineas = orden.lineas.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l));
    setOrden({ ...orden, lineas });
  };

  return (
    <div className="pagina">
      <header className="cab">
        <div>
          <h1>Compras</h1>
          <p>Proveedores, órdenes de compra y cuentas por pagar.</p>
        </div>
        {editable && (
          <div className="acciones">
            <button type="button" className="btn" onClick={() => setProvAbierto(true)}>
              Nuevo proveedor
            </button>
            <button type="button" className="btn btn-pri" onClick={() => setOrdenAbierta(true)}>
              Nueva orden
            </button>
          </div>
        )}
      </header>

      <section className="tarjeta tabla-caja">
        <h2>Órdenes de compra</h2>
        {ordenes.length === 0 ? (
          <p className="vacio">Sin órdenes de compra.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th className="der">Total</th>
                <th>Estado</th>
                <th>
                  <span className="sr">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => (
                <tr key={o.id}>
                  <td className="mono">{doc('OC', o.id)}</td>
                  <td>{nombreProveedor(o.proveedor_id)}</td>
                  <td className="suave">{o.fecha}</td>
                  <td className="der">{cop(Number(o.total))}</td>
                  <td>
                    <Estado valor={o.estado} />
                  </td>
                  <td className="der">
                    {editable && (o.estado === 'enviada' || o.estado === 'parcial') && (
                      <button
                        type="button"
                        className="btn btn-chico btn-pri"
                        onClick={() => {
                          setRecepcion(o);
                          setRecibidas({});
                        }}
                      >
                        Recibir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="columnas">
        <section className="tarjeta">
          <h2>Cuentas por pagar</h2>
          {cuentas.length === 0 ? (
            <p className="vacio">Sin cuentas por pagar.</p>
          ) : (
            <div className="tabla-caja">
              <table>
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th className="der">Saldo</th>
                    <th>Estado</th>
                    <th>
                      <span className="sr">Acción</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">{doc('OC', c.orden_compra_id)}</td>
                      <td className="der">{cop(Number(c.saldo))}</td>
                      <td>
                        <Estado valor={c.estado} />
                      </td>
                      <td className="der">
                        {editable && c.estado === 'abierta' && (
                          <button type="button" className="btn btn-chico" onClick={() => pagar(c)}>
                            Pagar
                          </button>
                        )}
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
          <ul className="lista">
            {proveedores.map((p) => (
              <li key={p.id}>
                <span>
                  <span className="fuerte">{p.razon_social}</span>
                  <br />
                  <span className="chico suave mono">NIT {p.nit}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Modal: nuevo proveedor */}
      <Modal titulo="Nuevo proveedor" abierto={provAbierto} onCerrar={() => setProvAbierto(false)}>
        <form className="form" onSubmit={crearProveedor}>
          <div className="form-2">
            <label className="campo">
              NIT
              <input value={prov.nit} onChange={(e) => setProv({ ...prov, nit: e.target.value })} required />
            </label>
            <label className="campo">
              Razón social
              <input
                value={prov.razon_social}
                onChange={(e) => setProv({ ...prov, razon_social: e.target.value })}
                required
              />
            </label>
            <label className="campo">
              Contacto
              <input value={prov.contacto} onChange={(e) => setProv({ ...prov, contacto: e.target.value })} />
            </label>
            <label className="campo">
              Teléfono
              <input value={prov.telefono} onChange={(e) => setProv({ ...prov, telefono: e.target.value })} />
            </label>
          </div>
          <div className="form-pie">
            <span />
            <button type="submit" className="btn btn-pri">
              Guardar proveedor
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: nueva orden de compra */}
      <Modal titulo="Nueva orden de compra" abierto={ordenAbierta} onCerrar={() => setOrdenAbierta(false)}>
        <form className="form" onSubmit={crearOrden}>
          <label className="campo">
            Proveedor
            <select
              value={orden.proveedor_id}
              onChange={(e) => setOrden({ ...orden, proveedor_id: e.target.value })}
              required
            >
              <option value="">Selecciona…</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.razon_social}
                </option>
              ))}
            </select>
          </label>
          {orden.lineas.map((l, i) => (
            <div key={i} className="form-2">
              <label className="campo">
                Material
                <select
                  value={l.material_id}
                  onChange={(e) => setLinea(i, 'material_id', e.target.value)}
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
              <label className="campo">
                Cantidad
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={l.cantidad}
                  onChange={(e) => setLinea(i, 'cantidad', e.target.value)}
                  required
                />
              </label>
              <label className="campo">
                Precio unitario
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={l.precio_unitario}
                  onChange={(e) => setLinea(i, 'precio_unitario', e.target.value)}
                  required
                />
              </label>
            </div>
          ))}
          <div className="form-pie">
            <button
              type="button"
              className="btn btn-chico"
              onClick={() => setOrden({ ...orden, lineas: [...orden.lineas, vaciaLinea()] })}
            >
              Agregar línea
            </button>
            <button type="submit" className="btn btn-pri">
              Crear orden
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: recepción */}
      <Modal
        titulo={recepcion ? `Recibir ${doc('OC', recepcion.id)}` : 'Recibir'}
        abierto={recepcion !== null}
        onCerrar={() => setRecepcion(null)}
      >
        {recepcion && (
          <form className="form" onSubmit={recibir}>
            <p className="chico suave">Indica cuánto se recibe de cada línea (máximo lo pendiente).</p>
            {recepcion.detalles.map((d) => {
              const pendiente = Number(d.cantidad) - Number(d.cantidad_recibida);
              return (
                <label className="campo" key={d.id}>
                  {nombreMaterial(d.material_id)} · pendiente {pendiente}
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={pendiente}
                    value={recibidas[d.id] ?? ''}
                    onChange={(e) => setRecibidas({ ...recibidas, [d.id]: e.target.value })}
                    disabled={pendiente === 0}
                  />
                </label>
              );
            })}
            <div className="form-pie">
              <span />
              <button type="submit" className="btn btn-pri">
                Registrar recepción
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

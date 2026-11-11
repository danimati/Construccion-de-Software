import { useCallback, useEffect, useState } from 'react';
import { api } from '../core/api.js';
import { useSesion } from '../core/sesion.jsx';
import { useAvisos } from '../shared/avisos.jsx';
import Modal from '../shared/Modal.jsx';
import { cop, doc, Estado } from '../shared/ui.jsx';

// Pantalla de ventas (RF04): clientes, cotizaciones, pedidos y facturación.
export default function Ventas() {
  const { puedeEditar } = useSesion();
  const avisos = useAvisos();
  const editable = puedeEditar('ventas');

  const [clientes, setClientes] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [productos, setProductos] = useState([]);

  const [clienteAbierto, setClienteAbierto] = useState(false);
  const [pedidoAbierto, setPedidoAbierto] = useState(false);

  const clienteVacio = { tipo: 'corp', documento: '', nombre: '', email: '', telefono: '', direccion: '' };
  const [cliente, setCliente] = useState(clienteVacio);
  const [pedido, setPedido] = useState({ cliente_id: '', lineas: [lineaVacia()] });

  function lineaVacia() {
    return { producto_id: '', cantidad: '', precio_unitario: '' };
  }

  const cargar = useCallback(async () => {
    const [cls, cots, peds, facs, prods] = await Promise.all([
      api.get('/clientes'),
      api.get('/cotizaciones'),
      api.get('/pedidos'),
      api.get('/facturas'),
      api.get('/productos'),
    ]);
    setClientes(cls);
    setCotizaciones(cots);
    setPedidos(peds);
    setFacturas(facs);
    setProductos(prods);
  }, []);

  useEffect(() => {
    cargar().catch(() => avisos.mostrar('No se pudieron cargar las ventas.', 'error'));
  }, [cargar, avisos]);

  async function accion(fn, exito) {
    const ok = await avisos.intentar(fn, exito);
    if (ok) await cargar();
    return ok;
  }

  const nombreCliente = (id) => clientes.find((c) => c.id === id)?.nombre ?? `Cliente ${id}`;

  async function crearCliente(ev) {
    ev.preventDefault();
    if (await accion(() => api.post('/clientes', cliente), 'Cliente creado.')) {
      setClienteAbierto(false);
      setCliente(clienteVacio);
    }
  }

  async function crearPedido(ev) {
    ev.preventDefault();
    const cuerpo = {
      cliente_id: Number(pedido.cliente_id),
      lineas: pedido.lineas.map((l) => ({
        producto_id: Number(l.producto_id),
        cantidad: Number(l.cantidad),
        precio_unitario: Number(l.precio_unitario),
      })),
    };
    if (await accion(() => api.post('/pedidos', cuerpo), 'Pedido registrado.')) {
      setPedidoAbierto(false);
      setPedido({ cliente_id: '', lineas: [lineaVacia()] });
    }
  }

  const convertir = (id) =>
    accion(() => api.post(`/cotizaciones/${id}/pedido`), `Cotización ${doc('COT', id)} convertida en pedido.`);
  const cancelar = (id) => accion(() => api.post(`/pedidos/${id}/cancelar`), `${doc('PED', id)} cancelado.`);
  const facturar = (id) => accion(() => api.post(`/pedidos/${id}/factura`), `${doc('PED', id)} facturado.`);

  const setLinea = (i, campo, valor) => {
    const lineas = pedido.lineas.map((l, idx) => {
      if (idx !== i) return l;
      const actualizado = { ...l, [campo]: valor };
      // Al elegir producto, sugiere su precio de venta.
      if (campo === 'producto_id') {
        const p = productos.find((x) => String(x.id) === String(valor));
        if (p) actualizado.precio_unitario = p.precio_venta;
      }
      return actualizado;
    });
    setPedido({ ...pedido, lineas });
  };

  return (
    <div className="pagina">
      <header className="cab">
        <div>
          <h1>Ventas (CRM)</h1>
          <p>Clientes corporativos, cotizaciones, pedidos y facturación.</p>
        </div>
        {editable && (
          <div className="acciones">
            <button type="button" className="btn" onClick={() => setClienteAbierto(true)}>
              Nuevo cliente
            </button>
            <button type="button" className="btn btn-pri" onClick={() => setPedidoAbierto(true)}>
              Nuevo pedido
            </button>
          </div>
        )}
      </header>

      <div className="columnas">
        <section className="tarjeta">
          <h2>Cotizaciones</h2>
          {cotizaciones.length === 0 ? (
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
                    <th>
                      <span className="sr">Acción</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cotizaciones.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">{doc('COT', c.id)}</td>
                      <td>{nombreCliente(c.cliente_id)}</td>
                      <td className="der">{cop(Number(c.total))}</td>
                      <td>
                        <Estado valor={c.estado} />
                      </td>
                      <td className="der">
                        {editable && c.estado === 'enviada' && (
                          <button type="button" className="btn btn-chico btn-pri" onClick={() => convertir(c.id)}>
                            A pedido
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
          <h2>Pedidos</h2>
          {pedidos.length === 0 ? (
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
                    <th>
                      <span className="sr">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((p) => {
                    const abierto = p.estado === 'confirmado' || p.estado === 'en_preparacion';
                    return (
                      <tr key={p.id}>
                        <td className="mono">{doc('PED', p.id)}</td>
                        <td>{nombreCliente(p.cliente_id)}</td>
                        <td className="suave">{p.canal}</td>
                        <td>
                          <Estado valor={p.estado} />
                        </td>
                        <td className="der">
                          {editable && abierto && (
                            <span className="grupo-btn">
                              <button type="button" className="btn btn-chico btn-pri" onClick={() => facturar(p.id)}>
                                Facturar
                              </button>
                              <button type="button" className="btn btn-chico" onClick={() => cancelar(p.id)}>
                                Cancelar
                              </button>
                            </span>
                          )}
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

      <section className="tarjeta">
        <h2>Facturas</h2>
        {facturas.length === 0 ? (
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
                {facturas.map((f) => (
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

      {/* Modal: nuevo cliente */}
      <Modal titulo="Nuevo cliente" abierto={clienteAbierto} onCerrar={() => setClienteAbierto(false)}>
        <form className="form" onSubmit={crearCliente}>
          <div className="form-2">
            <label className="campo">
              Tipo
              <select value={cliente.tipo} onChange={(e) => setCliente({ ...cliente, tipo: e.target.value })}>
                <option value="corp">Corporativo</option>
                <option value="final">Final</option>
              </select>
            </label>
            <label className="campo">
              Documento
              <input
                value={cliente.documento}
                onChange={(e) => setCliente({ ...cliente, documento: e.target.value })}
                required
              />
            </label>
            <label className="campo">
              Nombre
              <input
                value={cliente.nombre}
                onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
                required
              />
            </label>
            <label className="campo">
              Correo
              <input value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} />
            </label>
          </div>
          <div className="form-pie">
            <span />
            <button type="submit" className="btn btn-pri">
              Guardar cliente
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: nuevo pedido */}
      <Modal titulo="Nuevo pedido" abierto={pedidoAbierto} onCerrar={() => setPedidoAbierto(false)}>
        <form className="form" onSubmit={crearPedido}>
          <label className="campo">
            Cliente
            <select
              value={pedido.cliente_id}
              onChange={(e) => setPedido({ ...pedido, cliente_id: e.target.value })}
              required
            >
              <option value="">Selecciona…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          {pedido.lineas.map((l, i) => (
            <div key={i} className="form-2">
              <label className="campo">
                Producto
                <select
                  value={l.producto_id}
                  onChange={(e) => setLinea(i, 'producto_id', e.target.value)}
                  required
                >
                  <option value="">Selecciona…</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (disp. {p.stock_actual})
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
              onClick={() => setPedido({ ...pedido, lineas: [...pedido.lineas, lineaVacia()] })}
            >
              Agregar línea
            </button>
            <button type="submit" className="btn btn-pri">
              Registrar pedido
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// Prueba de carga del ERP NovaKey con k6.
//
// Simula 100 usuarios concurrentes repartidos en tres áreas (Producción, Compras y Ventas)
// que trabajan a través de Nginx (HTTPS), igual que la interfaz web. Incluye una operación
// transaccional de escritura (crear cotización con detalle) además de las consultas.
//
// Metas (RNF de capacidad): p95 < 500 ms y 0 % de solicitudes fallidas.
// Uso: ver pruebas/carga/README.md

import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "https://web/api";
const CLAVE = __ENV.CLAVE_DEMO || "novakey";
const MANTENER = __ENV.DURACION || "2m";

const etapas = (vus) => [
  { duration: "30s", target: vus },
  { duration: MANTENER, target: vus },
  { duration: "15s", target: 0 },
];

export const options = {
  insecureSkipTLSVerify: true, // certificado autofirmado de la demostración
  scenarios: {
    produccion: { executor: "ramping-vus", exec: "produccion", stages: etapas(34) },
    compras: { executor: "ramping-vus", exec: "compras", stages: etapas(33) },
    ventas: { executor: "ramping-vus", exec: "ventas", stages: etapas(33) },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate==0"],
    checks: ["rate==1"],
  },
};

function login(usuario) {
  const r = http.post(`${BASE}/auth/login`, JSON.stringify({ username: usuario, password: CLAVE }), {
    headers: { "Content-Type": "application/json" },
  });
  if (r.status !== 200) throw new Error(`login ${usuario}: ${r.status}`);
  return r.json("token");
}

export function setup() {
  return {
    produccion: login("princon"),
    compras: login("jsalcedo"),
    ventas: login("ecampos"),
  };
}

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });

function get(ruta, token, nombre) {
  const r = http.get(`${BASE}${ruta}`, { ...auth(token), tags: { name: nombre } });
  check(r, { [`${nombre} 200`]: (x) => x.status === 200 });
}

export function produccion(t) {
  get("/productos", t.produccion, "GET productos");
  get("/materiales", t.produccion, "GET materiales");
  get("/ordenes-produccion", t.produccion, "GET ordenes-produccion");
  get("/movimientos", t.produccion, "GET movimientos");
  sleep(1);
}

export function compras(t) {
  get("/proveedores", t.compras, "GET proveedores");
  get("/ordenes-compra", t.compras, "GET ordenes-compra");
  get("/cuentas-por-pagar", t.compras, "GET cuentas-por-pagar");
  sleep(1);
}

export function ventas(t) {
  get("/clientes", t.ventas, "GET clientes");
  get("/pedidos", t.ventas, "GET pedidos");
  const hoy = new Date();
  const vigencia = new Date(hoy.getTime() + 15 * 86400000).toISOString().slice(0, 10);
  const r = http.post(
    `${BASE}/cotizaciones`,
    JSON.stringify({
      cliente_id: 1 + Math.floor(Math.random() * 3),
      vigencia,
      lineas: [
        { producto_id: 1, cantidad: 2, precio_unitario: "690000" },
        { producto_id: 3, cantidad: 1, precio_unitario: "180000" },
      ],
    }),
    { ...auth(t.ventas), tags: { name: "POST cotizaciones" } },
  );
  check(r, { "POST cotizaciones 201": (x) => x.status === 201 });
  sleep(1);
}

export function handleSummary(data) {
  return {
    "/resultados/resumen.json": JSON.stringify(data, null, 2),
    stdout: textoResumen(data),
  };
}

function textoResumen(d) {
  const m = d.metrics;
  const f = (v) => (v === undefined ? "-" : v.toFixed(1));
  return [
    "",
    "== NovaKey · prueba de carga ==",
    `VUs máx: ${m.vus_max.values.max}`,
    `Solicitudes: ${m.http_reqs.values.count} (${f(m.http_reqs.values.rate)}/s)`,
    `Latencia ms  prom ${f(m.http_req_duration.values.avg)} · p90 ${f(m.http_req_duration.values["p(90)"])} · p95 ${f(m.http_req_duration.values["p(95)"])} · máx ${f(m.http_req_duration.values.max)}`,
    `Fallidas: ${(m.http_req_failed.values.rate * 100).toFixed(2)} %`,
    `Checks OK: ${(m.checks.values.rate * 100).toFixed(2)} %`,
    "",
  ].join("\n");
}

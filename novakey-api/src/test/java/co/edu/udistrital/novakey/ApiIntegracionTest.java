package co.edu.udistrital.novakey;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Pruebas de extremo a extremo de la API, con filtros de seguridad y PostgreSQL 17 real. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("demo")
@Import(ApiIntegracionTest.Bd.class)
class ApiIntegracionTest {

    @TestConfiguration(proxyBeanMethods = false)
    static class Bd {
        @Bean
        @ServiceConnection
        PostgreSQLContainer postgres() {
            return new PostgreSQLContainer("postgres:17-alpine");
        }
    }

    @Autowired
    MockMvc mvc;
    @Autowired
    JdbcTemplate jdbc;

    String gerencia, comercial, produccion, compras, rh, admin;

    @BeforeEach
    void reiniciar() throws Exception {
        admin = token("slinares");
        mvc.perform(post("/api/demo/reiniciar").header("Authorization", "Bearer " + admin)).andExpect(status().isOk());
        gerencia = token("mquintero");
        comercial = token("ecampos");
        produccion = token("princon");
        compras = token("jsalcedo");
        rh = token("nmedina");
    }

    private String token(String usuario) throws Exception {
        String r = mvc.perform(json(post("/api/auth/login"), "{\"username\":\"%s\",\"password\":\"novakey\"}".formatted(usuario)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(r, "$.token");
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder b, String cuerpo) {
        return b.contentType(MediaType.APPLICATION_JSON).content(cuerpo);
    }

    private static MockHttpServletRequestBuilder con(String token, MockHttpServletRequestBuilder b) {
        return b.header("Authorization", "Bearer " + token);
    }

    private int stockProducto(long id) {
        return jdbc.queryForObject("select stock_actual from producto where id_producto = ?", Integer.class, id);
    }

    private double stockMaterial(long id) {
        return jdbc.queryForObject("select stock_actual from material where id_material = ?", Double.class, id);
    }

    // ---------- Seguridad (RF01) ----------

    @Test
    void sinTokenResponde401() throws Exception {
        mvc.perform(get("/api/materiales")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/usuarios")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/materiales").header("Authorization", "Bearer token-falso")).andExpect(status().isUnauthorized());
    }

    @Test
    void credencialesIncorrectasResponden401() throws Exception {
        mvc.perform(json(post("/api/auth/login"), "{\"username\":\"mquintero\",\"password\":\"mala\"}")).andExpect(status().isUnauthorized());
        mvc.perform(json(post("/api/auth/login"), "{\"username\":\"nadie\",\"password\":\"novakey\"}")).andExpect(status().isUnauthorized());
    }

    @Test
    void cadaRolSoloAccedeASusModulos() throws Exception {
        mvc.perform(con(comercial, get("/api/clientes"))).andExpect(status().isOk());
        mvc.perform(con(comercial, get("/api/proveedores"))).andExpect(status().isForbidden());
        mvc.perform(con(comercial, get("/api/nominas"))).andExpect(status().isForbidden());
        mvc.perform(con(rh, get("/api/materiales"))).andExpect(status().isForbidden());
        mvc.perform(con(compras, get("/api/empleados/resumen"))).andExpect(status().isForbidden());
        mvc.perform(con(comercial, get("/api/usuarios"))).andExpect(status().isForbidden());
        mvc.perform(con(comercial, get("/api/roles"))).andExpect(status().isForbidden());
    }

    @Test
    void verNoPermiteEditar() throws Exception {
        mvc.perform(con(gerencia, post("/api/pedidos/3/factura"))).andExpect(status().isForbidden());
        mvc.perform(con(comercial, json(post("/api/movimientos/ajustes"), "{\"materialId\":1,\"cantidad\":5,\"motivo\":\"x\"}")))
                .andExpect(status().isForbidden());
        assertThat(stockMaterial(1)).isEqualTo(420);
    }

    @Test
    void desactivarUsuarioInvalidaSuTokenDeInmediato() throws Exception {
        mvc.perform(con(comercial, get("/api/clientes"))).andExpect(status().isOk());
        mvc.perform(con(admin, json(put("/api/usuarios/2/activo"), "{\"activo\":false}"))).andExpect(status().isOk());
        mvc.perform(con(comercial, get("/api/clientes"))).andExpect(status().isUnauthorized());
    }

    @Test
    void cambiarPermisoSurteEfectoSinNuevoLogin() throws Exception {
        mvc.perform(con(comercial, get("/api/nominas"))).andExpect(status().isForbidden());
        mvc.perform(con(admin, json(put("/api/roles/2/permisos/rh"), "{\"nivel\":\"ver\"}")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.permisos.rh").value("ver"));
        mvc.perform(con(comercial, get("/api/nominas"))).andExpect(status().isOk());
        mvc.perform(con(admin, json(put("/api/roles/2/permisos/rh"), "{\"nivel\":null}")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.permisos.rh").doesNotExist());
        mvc.perform(con(comercial, get("/api/nominas"))).andExpect(status().isForbidden());
    }

    @Test
    void administradorNoPuedeBloquearse() throws Exception {
        mvc.perform(con(admin, json(put("/api/roles/6/permisos/accesos"), "{\"nivel\":null}"))).andExpect(status().isConflict());
        mvc.perform(con(admin, json(put("/api/usuarios/6/activo"), "{\"activo\":false}"))).andExpect(status().isConflict());
        mvc.perform(con(admin, json(put("/api/usuarios/6/rol"), "{\"rolId\":1}"))).andExpect(status().isConflict());
    }

    @Test
    void laApiNuncaExponeContrasenas() throws Exception {
        mvc.perform(con(admin, get("/api/usuarios")))
                .andExpect(content().string(not(containsString("password"))))
                .andExpect(content().string(not(containsString("argon2"))));
        String hash = jdbc.queryForObject("select password_hash from usuario where username = 'slinares'", String.class);
        assertThat(hash).startsWith("$argon2id$");
    }

    @Test
    void usuarioNuevoPuedeEntrarConSuContrasena() throws Exception {
        mvc.perform(con(admin, json(post("/api/usuarios"),
                "{\"username\":\"nuevo\",\"email\":\"nuevo@novakey.example\",\"password\":\"clave-larga-1\",\"rolId\":2}")))
                .andExpect(status().isCreated());
        mvc.perform(json(post("/api/auth/login"), "{\"username\":\"nuevo\",\"password\":\"clave-larga-1\"}")).andExpect(status().isOk());
        mvc.perform(con(admin, json(post("/api/usuarios"),
                "{\"username\":\"corto\",\"email\":\"corto@novakey.example\",\"password\":\"123\",\"rolId\":2}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("8 caracteres")));
    }

    // ---------- Producción e inventario (RF02) ----------

    private long crearOrden(int cantidad) throws Exception {
        String r = mvc.perform(con(produccion, json(post("/api/ordenes-produccion"), "{\"productoId\":1,\"cantidad\":%d}".formatted(cantidad))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(r, "$.id")).longValue();
    }

    @Test
    void iniciarOrdenConsumeTodaLaLista() throws Exception {
        long id = crearOrden(10);
        mvc.perform(con(produccion, post("/api/ordenes-produccion/%d/iniciar".formatted(id))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("en_proceso")).andExpect(jsonPath("$.avance[0]").value(10));
        assertThat(stockMaterial(1)).isEqualTo(410);
        assertThat(stockMaterial(3)).isEqualTo(5360);
        assertThat(jdbc.queryForObject("select count(*) from consumo_material where id_orden_produccion = ?", Integer.class, id)).isEqualTo(9);
    }

    @Test
    void faltaUnMaterialYNoSeDescuentaNinguno() throws Exception {
        long id = crearOrden(65); // solo hay 64 pantallas OLED
        mvc.perform(con(produccion, post("/api/ordenes-produccion/%d/iniciar".formatted(id))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.detail").value(containsString("Pantalla OLED")));
        assertThat(stockMaterial(1)).isEqualTo(420);
        assertThat(jdbc.queryForObject("select count(*) from consumo_material where id_orden_produccion = ?", Integer.class, id)).isZero();
        assertThat(jdbc.queryForObject("select estado from orden_produccion where id_orden_produccion = ?", String.class, id)).isEqualTo("planeada");
    }

    @Test
    void lasEstacionesRespetanElOrdenYSoloSumanStockLasAprobadas() throws Exception {
        long id = crearOrden(2);
        String ruta = "/api/ordenes-produccion/%d/avance".formatted(id);
        mvc.perform(con(produccion, post("/api/ordenes-produccion/%d/iniciar".formatted(id)))).andExpect(status().isOk());
        mvc.perform(con(produccion, json(post(ruta), "{\"estacion\":2}"))).andExpect(status().isConflict());
        for (int estacion = 1; estacion <= 3; estacion++) {
            for (int i = 0; i < 2; i++) {
                mvc.perform(con(produccion, json(post(ruta), "{\"estacion\":%d}".formatted(estacion)))).andExpect(status().isOk());
            }
        }
        mvc.perform(con(produccion, json(post(ruta), "{\"estacion\":4}")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.detail").value(containsString("resultado")));
        int stock = stockProducto(1);
        mvc.perform(con(produccion, json(post(ruta), "{\"estacion\":4,\"resultado\":\"aprobada\"}"))).andExpect(status().isOk());
        mvc.perform(con(produccion, json(post(ruta), "{\"estacion\":4,\"resultado\":\"rechazada\"}"))).andExpect(status().isOk());
        mvc.perform(con(produccion, json(post(ruta), "{\"estacion\":5}")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("terminada"));
        mvc.perform(con(produccion, json(post(ruta), "{\"estacion\":5}"))).andExpect(status().isConflict());
        assertThat(stockProducto(1)).isEqualTo(stock + 1);
        assertThat(jdbc.queryForList("select numero_serie from unidad_producida where id_orden_produccion = ?", String.class, id))
                .hasSize(2).doesNotHaveDuplicates().allMatch(s -> s.startsWith("NK75-"));
    }

    @Test
    void ajusteNoDejaStockNegativoYQuedaRegistrado() throws Exception {
        mvc.perform(con(produccion, json(post("/api/movimientos/ajustes"), "{\"materialId\":5,\"cantidad\":-97,\"motivo\":\"Conteo\"}")))
                .andExpect(status().isConflict());
        mvc.perform(con(produccion, json(post("/api/movimientos/ajustes"), "{\"materialId\":5,\"cantidad\":-6,\"motivo\":\"Conteo\"}")))
                .andExpect(status().isCreated());
        assertThat(stockMaterial(5)).isEqualTo(90);
        mvc.perform(con(produccion, get("/api/movimientos")))
                .andExpect(jsonPath("$[0].documentoRef").value("Conteo")).andExpect(jsonPath("$[0].usuario").value("princon"));
    }

    // ---------- Compras (RF03) ----------

    @Test
    void recepcionParcialYTotalActualizanStockYCuenta() throws Exception {
        long linea = jdbc.queryForObject("select id_detalle_oc from detalle_orden_compra where id_orden_compra = 3", Long.class);
        mvc.perform(con(compras, json(post("/api/ordenes-compra/3/recepciones"), "{\"cantidades\":{\"%d\":50}}".formatted(linea))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("parcial"));
        assertThat(stockMaterial(5)).isEqualTo(146);
        assertThat(jdbc.queryForObject("select saldo from cuenta_por_pagar where id_orden_compra = 3", Double.class)).isEqualTo(2900000);
        mvc.perform(con(compras, json(post("/api/ordenes-compra/3/recepciones"), "{\"cantidades\":{\"%d\":100}}".formatted(linea))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("recibida"));
        assertThat(jdbc.queryForObject("select saldo from cuenta_por_pagar where id_orden_compra = 3", Double.class)).isEqualTo(8700000);
        mvc.perform(con(compras, json(post("/api/ordenes-compra/3/recepciones"), "{\"cantidades\":{\"%d\":1}}".formatted(linea))))
                .andExpect(status().isConflict());
    }

    @Test
    void noSeRecibeMasDeLoPendienteNiSePagaMasQueElSaldo() throws Exception {
        long linea = jdbc.queryForObject("select id_detalle_oc from detalle_orden_compra where id_orden_compra = 3", Long.class);
        mvc.perform(con(compras, json(post("/api/ordenes-compra/3/recepciones"), "{\"cantidades\":{\"%d\":151}}".formatted(linea))))
                .andExpect(status().isConflict());
        assertThat(stockMaterial(5)).isEqualTo(96);
        mvc.perform(con(compras, json(post("/api/cuentas-por-pagar/1/pagos"), "{\"monto\":8360001}"))).andExpect(status().isConflict());
        mvc.perform(con(compras, json(post("/api/cuentas-por-pagar/1/pagos"), "{\"monto\":8360000}")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("pagada"));
    }

    // ---------- Ventas (RF04) ----------

    @Test
    void cotizacionPedidoYFacturaConIva() throws Exception {
        String r = mvc.perform(con(comercial, post("/api/cotizaciones/2/pedido")))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        int pedido = JsonPath.read(r, "$.id");
        assertThat(stockProducto(1)).isEqualTo(43);
        mvc.perform(con(comercial, post("/api/pedidos/%d/factura".formatted(pedido))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.numero").value("FAC-0002"))
                .andExpect(jsonPath("$.subtotal").value(3450000))
                .andExpect(jsonPath("$.impuestos").value(655500))
                .andExpect(jsonPath("$.total").value(4105500));
        mvc.perform(con(comercial, post("/api/pedidos/%d/factura".formatted(pedido)))).andExpect(status().isConflict());
    }

    @Test
    void sinDisponibilidadSeDeshaceTodoElPedido() throws Exception {
        String lineas = "[{\"productoId\":1,\"cantidad\":1,\"precioUnitario\":690000},{\"productoId\":2,\"cantidad\":13,\"precioUnitario\":590000}]";
        int pedidos = jdbc.queryForObject("select count(*) from pedido", Integer.class);
        mvc.perform(con(comercial, json(post("/api/pedidos"), "{\"clienteId\":1,\"lineas\":%s}".formatted(lineas))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.detail").value(containsString("disponibles 12")));
        assertThat(stockProducto(1)).isEqualTo(48);
        assertThat(jdbc.queryForObject("select count(*) from pedido", Integer.class)).isEqualTo(pedidos);
    }

    @Test
    void cancelarPedidoDevuelveStock() throws Exception {
        mvc.perform(con(comercial, post("/api/pedidos/3/cancelar"))).andExpect(status().isOk());
        assertThat(stockProducto(1)).isEqualTo(58);
        mvc.perform(con(comercial, post("/api/pedidos/3/factura"))).andExpect(status().isConflict());
    }

    /** Requisito de integridad con los 100 usuarios concurrentes: nunca se vende más de lo disponible. */
    @Test
    void cienPedidosSimultaneosNoSobrevenden() throws Exception {
        String cuerpo = "{\"clienteId\":1,\"lineas\":[{\"productoId\":1,\"cantidad\":1,\"precioUnitario\":690000}]}";
        List<Callable<Integer>> tareas = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            tareas.add(() -> mvc.perform(con(comercial, json(post("/api/pedidos"), cuerpo))).andReturn().getResponse().getStatus());
        }
        ExecutorService hilos = Executors.newFixedThreadPool(100);
        List<Integer> estados = new ArrayList<>();
        for (Future<Integer> f : hilos.invokeAll(tareas)) estados.add(f.get());
        hilos.shutdown();

        assertThat(estados).filteredOn(s -> s == 201).hasSize(48);
        assertThat(estados).filteredOn(s -> s == 409).hasSize(52);
        assertThat(stockProducto(1)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from movimiento_inventario where tipo = 'salida_venta' and documento_ref <> 'PED-0003'", Integer.class)).isEqualTo(48);
    }

    // ---------- Recursos Humanos (RF05) ----------

    @Test
    void nominaDelMesSiguienteRecalculaElNeto() throws Exception {
        String r = mvc.perform(con(rh, post("/api/nominas")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.periodoInicio").value("2026-11-01"))
                .andExpect(jsonPath("$.periodoFin").value("2026-11-30"))
                .andExpect(jsonPath("$.detalles", hasSize(8)))
                .andReturn().getResponse().getContentAsString();
        int nomina = JsonPath.read(r, "$.id");
        List<Integer> detalles = JsonPath.read(r, "$.detalles[?(@.empleadoId==1)].id");
        int detalle = detalles.get(0);
        mvc.perform(con(rh, json(put("/api/nominas/%d/detalles/%d/devengados".formatted(nomina, detalle)), "{\"devengados\":100000}")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.detalles[?(@.empleadoId==1)].netoPagar").value(8840000.0));
        mvc.perform(con(rh, post("/api/nominas"))).andExpect(status().isConflict());
        mvc.perform(con(rh, post("/api/nominas/%d/pagar".formatted(nomina)))).andExpect(status().isOk());
        mvc.perform(con(rh, json(put("/api/nominas/%d/detalles/%d/devengados".formatted(nomina, detalle)), "{\"devengados\":1}")))
                .andExpect(status().isConflict());
    }

    @Test
    void empleadoNuevoRecibeHorarioDeLunesAViernes() throws Exception {
        mvc.perform(con(rh, json(post("/api/empleados"),
                "{\"cargoId\":4,\"documento\":\"777\",\"nombres\":\"Ana\",\"apellidos\":\"Prueba\",\"fechaIngreso\":\"2026-11-04\",\"horaInicio\":\"08:00\",\"horaFin\":\"17:00\"}")))
                .andExpect(status().isCreated());
        assertThat(jdbc.queryForObject("select count(*) from horario h join empleado e using (id_empleado) where e.documento = '777'", Integer.class)).isEqualTo(5);
        mvc.perform(con(rh, json(post("/api/empleados"),
                "{\"cargoId\":4,\"documento\":\"778\",\"nombres\":\"Ana\",\"apellidos\":\"Prueba\",\"fechaIngreso\":\"2026-11-04\",\"horaInicio\":\"18:00\",\"horaFin\":\"17:00\"}")))
                .andExpect(status().isConflict());
    }
}

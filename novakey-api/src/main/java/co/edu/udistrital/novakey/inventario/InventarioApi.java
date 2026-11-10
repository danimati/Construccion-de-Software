package co.edu.udistrital.novakey.inventario;

import co.edu.udistrital.novakey.comun.Errores.NoEncontrado;
import co.edu.udistrital.novakey.comun.Errores.ReglaNegocio;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Year;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import co.edu.udistrital.novakey.iam.UsuarioActual;

@RestController
@RequestMapping("/api")
class InventarioApi {

    private static final int ESTACION_CALIDAD = 4;
    private static final int ESTACION_EMPAQUE = 5;
    private static final String[] ESTACIONES = {"Almacén de componentes", "Ensamblaje de PCB", "Montaje del teclado",
            "Integración OLED", "Control de calidad", "Empaque y despacho"};

    public record MaterialDto(Long id, String codigo, String nombre, String unidadMedida, BigDecimal stockActual,
            BigDecimal stockMinimo, BigDecimal costoUnitario) {
        static MaterialDto de(Material m) {
            return new MaterialDto(m.getId(), m.getCodigo(), m.getNombre(), m.getUnidadMedida(), m.getStockActual(),
                    m.getStockMinimo(), m.getCostoUnitario());
        }
    }

    public record ProductoDto(Long id, String sku, String nombre, BigDecimal precioVenta, int stockActual, boolean activo) {
        static ProductoDto de(Producto p) {
            return new ProductoDto(p.getId(), p.getSku(), p.getNombre(), p.getPrecioVenta(), p.getStockActual(), p.isActivo());
        }
    }

    public record LineaMaterialDto(Long productoId, Long materialId, BigDecimal cantidad) {}

    public record OrdenProduccionDto(Long id, Long productoId, Long usuarioId, int cantidad, LocalDate fechaInicio,
            LocalDate fechaFin, EstadoOrdenProduccion estado, int[] avance) {
        static OrdenProduccionDto de(OrdenProduccion o) {
            return new OrdenProduccionDto(o.getId(), o.getProductoId(), o.getUsuarioId(), o.getCantidad(),
                    o.getFechaInicio(), o.getFechaFin(), o.getEstado(), o.getAvance());
        }
    }

    public record ConsumoDto(Long id, Long ordenProduccionId, Long materialId, BigDecimal cantidad, LocalDateTime fecha) {}

    public record UnidadDto(Long id, Long ordenProduccionId, String numeroSerie, ResultadoCalidad resultadoCalidad,
            LocalDateTime fechaEnsamblaje) {}

    public record MovimientoDto(Long id, Long materialId, Long productoId, Long usuarioId, String usuario,
            TipoMovimiento tipo, BigDecimal cantidad, String documentoRef, LocalDateTime fecha) {}

    public record NuevaOrden(@NotNull(message = "Selecciona un producto.") Long productoId,
            @NotNull(message = "La cantidad debe ser un entero mayor que cero.") @Positive(message = "La cantidad debe ser un entero mayor que cero.") Integer cantidad) {}

    public record Avance(@NotNull @Min(1) @Max(5) Integer estacion, ResultadoCalidad resultado) {}

    public record Ajuste(Long materialId, Long productoId,
            @NotNull(message = "Indica una cantidad.") BigDecimal cantidad,
            @NotBlank(message = "Indica el motivo del ajuste.") @Size(max = 40) String motivo) {}

    private final MaterialRepo materiales;
    private final ProductoRepo productos;
    private final LineaMaterialRepo listas;
    private final OrdenProduccionRepo ordenes;
    private final ConsumoRepo consumos;
    private final UnidadRepo unidades;
    private final MovimientoRepo movimientos;
    private final Existencias existencias;
    private final UsuarioActual usuario;
    private final JdbcTemplate jdbc;

    InventarioApi(MaterialRepo materiales, ProductoRepo productos, LineaMaterialRepo listas, OrdenProduccionRepo ordenes,
            ConsumoRepo consumos, UnidadRepo unidades, MovimientoRepo movimientos, Existencias existencias,
            UsuarioActual usuario, JdbcTemplate jdbc) {
        this.materiales = materiales;
        this.productos = productos;
        this.listas = listas;
        this.ordenes = ordenes;
        this.consumos = consumos;
        this.unidades = unidades;
        this.movimientos = movimientos;
        this.existencias = existencias;
        this.usuario = usuario;
        this.jdbc = jdbc;
    }

    private static String doc(Long id) {
        return String.format("OP-%04d", id);
    }

    @GetMapping("/materiales")
    @PreAuthorize("hasAnyAuthority('inventario:ver', 'produccion:ver', 'compras:ver')")
    public List<MaterialDto> materiales() {
        return materiales.findAllByOrderById().stream().map(MaterialDto::de).toList();
    }

    @GetMapping("/productos")
    @PreAuthorize("hasAnyAuthority('inventario:ver', 'produccion:ver', 'ventas:ver')")
    public List<ProductoDto> productos() {
        return productos.findAllByOrderById().stream().map(ProductoDto::de).toList();
    }

    @GetMapping("/lista-materiales")
    @PreAuthorize("hasAnyAuthority('inventario:ver', 'produccion:ver')")
    public List<LineaMaterialDto> listaMateriales() {
        return listas.findAll().stream()
                .map(l -> new LineaMaterialDto(l.getProductoId(), l.getMaterialId(), l.getCantidad())).toList();
    }

    @GetMapping("/movimientos")
    @PreAuthorize("hasAuthority('inventario:ver')")
    public List<MovimientoDto> movimientos(@RequestParam(defaultValue = "200") int limite) {
        // El nombre de usuario se resuelve aquí para no exigir el permiso de Accesos a quien consulta inventario.
        var nombres = new java.util.HashMap<Long, String>();
        jdbc.query("select id_usuario, username from usuario", rs -> {
            nombres.put(rs.getLong(1), rs.getString(2));
        });
        return movimientos.findAllByOrderByIdDesc(Limit.of(Math.max(1, Math.min(limite, 1000)))).stream()
                .map(m -> new MovimientoDto(m.getId(), m.getMaterialId(), m.getProductoId(), m.getUsuarioId(),
                        nombres.get(m.getUsuarioId()), m.getTipo(), m.getCantidad(), m.getDocumentoRef(), m.getFecha()))
                .toList();
    }

    @PostMapping("/movimientos/ajustes")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventario:editar')")
    @Transactional
    public void ajustar(@Valid @RequestBody Ajuste a) {
        if (a.cantidad().signum() == 0) throw new ReglaNegocio("Indica una cantidad distinta de cero.");
        if ((a.materialId() == null) == (a.productoId() == null)) throw new ReglaNegocio("Selecciona un material o producto.");
        if (a.materialId() != null) {
            Material m = materiales.bloquear(a.materialId()).orElseThrow(() -> new NoEncontrado("Material no encontrado."));
            BigDecimal nuevo = m.getStockActual().add(a.cantidad());
            if (nuevo.signum() < 0) throw new ReglaNegocio(m.getNombre() + ": solo hay " + m.getStockActual().stripTrailingZeros().toPlainString() + " en stock.");
            m.setStockActual(nuevo);
        } else {
            if (a.cantidad().stripTrailingZeros().scale() > 0) throw new ReglaNegocio("Los productos se ajustan en unidades enteras.");
            Producto p = productos.bloquear(a.productoId()).orElseThrow(() -> new NoEncontrado("Producto no encontrado."));
            int nuevo = p.getStockActual() + a.cantidad().intValueExact();
            if (nuevo < 0) throw new ReglaNegocio(p.getNombre() + ": solo hay " + p.getStockActual() + " en stock.");
            p.setStockActual(nuevo);
        }
        existencias.registrar(a.materialId(), a.productoId(), TipoMovimiento.ajuste, a.cantidad(), a.motivo().trim());
    }

    @GetMapping("/ordenes-produccion")
    @PreAuthorize("hasAuthority('produccion:ver')")
    public List<OrdenProduccionDto> ordenes() {
        return ordenes.findAllByOrderByIdDesc().stream().map(OrdenProduccionDto::de).toList();
    }

    @PostMapping("/ordenes-produccion")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('produccion:editar')")
    @Transactional
    public OrdenProduccionDto crearOrden(@Valid @RequestBody NuevaOrden n) {
        if (!productos.existsById(n.productoId())) throw new NoEncontrado("Producto no encontrado.");
        if (!listas.existsByProductoId(n.productoId())) throw new ReglaNegocio("El producto no tiene lista de materiales.");
        OrdenProduccion o = new OrdenProduccion();
        o.setProductoId(n.productoId());
        o.setUsuarioId(usuario.id());
        o.setCantidad(n.cantidad());
        return OrdenProduccionDto.de(ordenes.save(o));
    }

    /** Consume todos los materiales de la lista; si falta alguno, no se descuenta ninguno. */
    @PostMapping("/ordenes-produccion/{id}/iniciar")
    @PreAuthorize("hasAuthority('produccion:editar')")
    @Transactional
    public OrdenProduccionDto iniciar(@PathVariable Long id) {
        OrdenProduccion o = bloquearOrden(id);
        if (o.getEstado() != EstadoOrdenProduccion.planeada) throw new ReglaNegocio("La orden no está planeada.");
        List<String> faltantes = new ArrayList<>();
        LocalDateTime ahora = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
        for (LineaMaterial linea : listas.findByProductoIdOrderByMaterialId(o.getProductoId())) {
            Material m = materiales.bloquear(linea.getMaterialId()).orElseThrow();
            BigDecimal requerido = linea.getCantidad().multiply(BigDecimal.valueOf(o.getCantidad()));
            BigDecimal falta = requerido.subtract(m.getStockActual());
            if (falta.signum() > 0) {
                faltantes.add(m.getNombre() + " (faltan " + falta.setScale(0, RoundingMode.CEILING).toPlainString() + ")");
                continue;
            }
            m.setStockActual(m.getStockActual().subtract(requerido));
            ConsumoMaterial c = new ConsumoMaterial();
            c.setOrdenProduccionId(id);
            c.setMaterialId(m.getId());
            c.setCantidad(requerido);
            c.setFecha(ahora);
            consumos.save(c);
            existencias.registrar(m.getId(), null, TipoMovimiento.salida_produccion, requerido, doc(id));
        }
        if (!faltantes.isEmpty()) throw new ReglaNegocio("Material insuficiente: " + String.join(", ", faltantes) + ".");
        o.setEstado(EstadoOrdenProduccion.en_proceso);
        o.setFechaInicio(LocalDate.now());
        o.setAvance(new int[] {o.getCantidad(), 0, 0, 0, 0, 0});
        return OrdenProduccionDto.de(o);
    }

    @PostMapping("/ordenes-produccion/{id}/cancelar")
    @PreAuthorize("hasAuthority('produccion:editar')")
    @Transactional
    public OrdenProduccionDto cancelar(@PathVariable Long id) {
        OrdenProduccion o = bloquearOrden(id);
        if (o.getEstado() != EstadoOrdenProduccion.planeada) throw new ReglaNegocio("Solo se cancelan órdenes planeadas.");
        o.setEstado(EstadoOrdenProduccion.cancelada);
        return OrdenProduccionDto.de(o);
    }

    /** Avanza una unidad en una estación. En calidad exige el resultado y asigna el número de serie. */
    @PostMapping("/ordenes-produccion/{id}/avance")
    @PreAuthorize("hasAuthority('produccion:editar')")
    @Transactional
    public OrdenProduccionDto avanzar(@PathVariable Long id, @Valid @RequestBody Avance a) {
        OrdenProduccion o = bloquearOrden(id);
        if (o.getEstado() != EstadoOrdenProduccion.en_proceso) throw new ReglaNegocio("La orden no está en proceso.");
        int estacion = a.estacion();
        int[] avance = o.getAvance().clone();
        long aprobadas = unidades.countByOrdenProduccionIdAndResultadoCalidad(id, ResultadoCalidad.aprobada);
        long limite = estacion == ESTACION_EMPAQUE ? aprobadas : avance[estacion - 1];
        if (avance[estacion] >= limite) throw new ReglaNegocio("No hay unidades pendientes en " + ESTACIONES[estacion] + ".");

        if (estacion == ESTACION_CALIDAD) {
            if (a.resultado() == null) throw new ReglaNegocio("Indica el resultado de calidad.");
            Producto producto = productos.findById(o.getProductoId()).orElseThrow();
            String[] sku = producto.getSku().split("-");
            UnidadProducida u = new UnidadProducida();
            u.setOrdenProduccionId(id);
            u.setNumeroSerie(String.format("NK%s-%d-%06d", sku[sku.length - 1], Year.now().getValue(), unidades.siguienteSerie()));
            u.setResultadoCalidad(a.resultado());
            u.setFechaEnsamblaje(LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS));
            unidades.save(u);
            if (a.resultado() == ResultadoCalidad.aprobada) aprobadas++;
        }
        avance[estacion]++;
        o.setAvance(avance);
        if (estacion == ESTACION_EMPAQUE) {
            Producto producto = productos.bloquear(o.getProductoId()).orElseThrow();
            producto.setStockActual(producto.getStockActual() + 1);
            existencias.registrar(null, producto.getId(), TipoMovimiento.entrada_produccion, BigDecimal.ONE, doc(id));
        }
        if (avance[ESTACION_CALIDAD] == o.getCantidad() && avance[ESTACION_EMPAQUE] == aprobadas) {
            o.setEstado(EstadoOrdenProduccion.terminada);
            o.setFechaFin(LocalDate.now());
        }
        return OrdenProduccionDto.de(o);
    }

    private OrdenProduccion bloquearOrden(Long id) {
        return ordenes.bloquear(id).orElseThrow(() -> new NoEncontrado("La orden no existe."));
    }

    @GetMapping("/consumos")
    @PreAuthorize("hasAuthority('produccion:ver')")
    public List<ConsumoDto> consumos() {
        return consumos.findAll().stream()
                .map(c -> new ConsumoDto(c.getId(), c.getOrdenProduccionId(), c.getMaterialId(), c.getCantidad(), c.getFecha()))
                .toList();
    }

    @GetMapping("/unidades")
    @PreAuthorize("hasAuthority('produccion:ver')")
    public List<UnidadDto> unidades() {
        return unidades.findAll().stream()
                .map(u -> new UnidadDto(u.getId(), u.getOrdenProduccionId(), u.getNumeroSerie(), u.getResultadoCalidad(), u.getFechaEnsamblaje()))
                .toList();
    }
}

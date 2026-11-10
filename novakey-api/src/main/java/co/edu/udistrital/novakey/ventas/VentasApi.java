package co.edu.udistrital.novakey.ventas;

import co.edu.udistrital.novakey.comun.Errores.NoEncontrado;
import co.edu.udistrital.novakey.comun.Errores.ReglaNegocio;
import co.edu.udistrital.novakey.iam.UsuarioActual;
import co.edu.udistrital.novakey.inventario.Existencias;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.LockModeType;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

// Los valores coinciden en minúsculas con el ENUM del diagrama ER y con el JSON de la API.
enum EstadoCotizacion { enviada, aceptada, rechazada }

enum EstadoPedido { confirmado, en_preparacion, facturado, cancelado }

enum CanalPedido { directo, web }

enum EstadoFactura { emitida, pagada }

@Entity
@Table(name = "cliente")
@Getter
@Setter
class Cliente {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cliente")
    private Long id;
    private String tipo;
    private String documento;
    private String nombre;
    private String email;
    private String telefono;
    private String direccion;
}

@Entity
@Table(name = "detalle_cotizacion")
@Getter
@Setter
class DetalleCotizacion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_detalle_cot")
    private Long id;
    @Column(name = "id_producto")
    private Long productoId;
    private int cantidad;
    @Column(name = "precio_unitario")
    private BigDecimal precioUnitario;
}

@Entity
@Table(name = "cotizacion")
@Getter
@Setter
class Cotizacion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cotizacion")
    private Long id;
    @Column(name = "id_cliente")
    private Long clienteId;
    @Column(name = "id_usuario")
    private Long usuarioId;
    private LocalDate fecha;
    private LocalDate vigencia;
    @Enumerated(EnumType.STRING)
    private EstadoCotizacion estado = EstadoCotizacion.enviada;
    private BigDecimal total;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "id_cotizacion", nullable = false)
    @BatchSize(size = 50)
    private List<DetalleCotizacion> detalles = new ArrayList<>();
}

@Entity
@Table(name = "detalle_pedido")
@Getter
@Setter
class DetallePedido {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_detalle_pedido")
    private Long id;
    @Column(name = "id_producto")
    private Long productoId;
    private int cantidad;
    @Column(name = "precio_unitario")
    private BigDecimal precioUnitario;
}

@Entity
@Table(name = "pedido")
@Getter
@Setter
class Pedido {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_pedido")
    private Long id;
    @Column(name = "id_cliente")
    private Long clienteId;
    @Column(name = "id_cotizacion")
    private Long cotizacionId;
    @Enumerated(EnumType.STRING)
    private CanalPedido canal = CanalPedido.directo;
    private LocalDateTime fecha;
    @Enumerated(EnumType.STRING)
    private EstadoPedido estado = EstadoPedido.confirmado;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "id_pedido", nullable = false)
    @BatchSize(size = 50)
    private List<DetallePedido> detalles = new ArrayList<>();

    boolean abierto() {
        return estado == EstadoPedido.confirmado || estado == EstadoPedido.en_preparacion;
    }
}

@Entity
@Table(name = "factura")
@Getter
@Setter
class Factura {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_factura")
    private Long id;
    @Column(name = "id_pedido")
    private Long pedidoId;
    private String numero;
    private LocalDate fecha;
    private BigDecimal subtotal;
    private BigDecimal impuestos;
    private BigDecimal total;
    @Enumerated(EnumType.STRING)
    private EstadoFactura estado = EstadoFactura.emitida;
}

interface ClienteRepo extends JpaRepository<Cliente, Long> {
    boolean existsByDocumento(String documento);

    List<Cliente> findAllByOrderById();
}

interface CotizacionRepo extends JpaRepository<Cotizacion, Long> {
    List<Cotizacion> findAllByOrderByIdDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Cotizacion c where c.id = :id")
    Optional<Cotizacion> bloquear(@Param("id") Long id);
}

interface PedidoRepo extends JpaRepository<Pedido, Long> {
    List<Pedido> findAllByOrderByIdDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Pedido p where p.id = :id")
    Optional<Pedido> bloquear(@Param("id") Long id);
}

interface FacturaRepo extends JpaRepository<Factura, Long> {
    List<Factura> findAllByOrderByIdDesc();

    @Query(value = "select nextval('numero_factura_seq')", nativeQuery = true)
    long siguienteNumero();
}

@RestController
@RequestMapping("/api")
class VentasApi {

    private static final BigDecimal TASA_IVA = new BigDecimal("0.19");

    public record ClienteDto(Long id, String tipo, String documento, String nombre, String email, String telefono, String direccion) {
        static ClienteDto de(Cliente c) {
            return new ClienteDto(c.getId(), c.getTipo(), c.getDocumento(), c.getNombre(), c.getEmail(), c.getTelefono(), c.getDireccion());
        }
    }

    public record LineaDto(Long id, Long productoId, int cantidad, BigDecimal precioUnitario) {}

    public record CotizacionDto(Long id, Long clienteId, Long usuarioId, LocalDate fecha, LocalDate vigencia,
            EstadoCotizacion estado, BigDecimal total, List<LineaDto> detalles) {
        static CotizacionDto de(Cotizacion c) {
            return new CotizacionDto(c.getId(), c.getClienteId(), c.getUsuarioId(), c.getFecha(), c.getVigencia(), c.getEstado(), c.getTotal(),
                    c.getDetalles().stream().map(d -> new LineaDto(d.getId(), d.getProductoId(), d.getCantidad(), d.getPrecioUnitario())).toList());
        }
    }

    public record PedidoDto(Long id, Long clienteId, Long cotizacionId, CanalPedido canal, LocalDateTime fecha,
            EstadoPedido estado, List<LineaDto> detalles) {
        static PedidoDto de(Pedido p) {
            return new PedidoDto(p.getId(), p.getClienteId(), p.getCotizacionId(), p.getCanal(), p.getFecha(), p.getEstado(),
                    p.getDetalles().stream().map(d -> new LineaDto(d.getId(), d.getProductoId(), d.getCantidad(), d.getPrecioUnitario())).toList());
        }
    }

    public record FacturaDto(Long id, Long pedidoId, String numero, LocalDate fecha, BigDecimal subtotal,
            BigDecimal impuestos, BigDecimal total, EstadoFactura estado) {
        static FacturaDto de(Factura f) {
            return new FacturaDto(f.getId(), f.getPedidoId(), f.getNumero(), f.getFecha(), f.getSubtotal(), f.getImpuestos(), f.getTotal(), f.getEstado());
        }
    }

    public record NuevoCliente(@NotBlank @jakarta.validation.constraints.Pattern(regexp = "corp|final", message = "Tipo de cliente no válido.") String tipo,
            @NotBlank(message = "El documento es obligatorio.") String documento,
            @NotBlank(message = "El nombre es obligatorio.") String nombre,
            String email, String telefono, String direccion) {}

    public record NuevaLinea(@NotNull(message = "Selecciona un producto.") Long productoId,
            @NotNull(message = "La cantidad debe ser mayor que cero.") @Positive(message = "La cantidad debe ser mayor que cero.") Integer cantidad,
            @NotNull(message = "El precio debe ser mayor que cero.") @Positive(message = "El precio debe ser mayor que cero.") BigDecimal precioUnitario) {}

    public record NuevaCotizacion(@NotNull(message = "Selecciona un cliente.") Long clienteId,
            @NotEmpty(message = "Agrega al menos una línea.") List<@Valid NuevaLinea> lineas,
            @NotNull(message = "Indica la vigencia.") LocalDate vigencia) {}

    public record NuevoPedido(@NotNull(message = "Selecciona un cliente.") Long clienteId,
            @NotEmpty(message = "Agrega al menos una línea.") List<@Valid NuevaLinea> lineas) {}

    private final ClienteRepo clientes;
    private final CotizacionRepo cotizaciones;
    private final PedidoRepo pedidos;
    private final FacturaRepo facturas;
    private final Existencias existencias;
    private final UsuarioActual usuario;

    VentasApi(ClienteRepo clientes, CotizacionRepo cotizaciones, PedidoRepo pedidos, FacturaRepo facturas,
            Existencias existencias, UsuarioActual usuario) {
        this.clientes = clientes;
        this.cotizaciones = cotizaciones;
        this.pedidos = pedidos;
        this.facturas = facturas;
        this.existencias = existencias;
        this.usuario = usuario;
    }

    private static String doc(Long id) {
        return String.format("PED-%04d", id);
    }

    @GetMapping("/clientes")
    @PreAuthorize("hasAuthority('ventas:ver')")
    public List<ClienteDto> clientes() {
        return clientes.findAllByOrderById().stream().map(ClienteDto::de).toList();
    }

    @PostMapping("/clientes")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ventas:editar')")
    @Transactional
    public ClienteDto crearCliente(@Valid @RequestBody NuevoCliente n) {
        String documento = n.documento().trim();
        if (clientes.existsByDocumento(documento)) throw new ReglaNegocio("Ya existe un cliente con ese documento.");
        Cliente c = new Cliente();
        c.setTipo(n.tipo());
        c.setDocumento(documento);
        c.setNombre(n.nombre().trim());
        c.setEmail(n.email());
        c.setTelefono(n.telefono());
        c.setDireccion(n.direccion());
        return ClienteDto.de(clientes.save(c));
    }

    @GetMapping("/cotizaciones")
    @PreAuthorize("hasAuthority('ventas:ver')")
    public List<CotizacionDto> cotizaciones() {
        return cotizaciones.findAllByOrderByIdDesc().stream().map(CotizacionDto::de).toList();
    }

    @PostMapping("/cotizaciones")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ventas:editar')")
    @Transactional
    public CotizacionDto crearCotizacion(@Valid @RequestBody NuevaCotizacion n) {
        if (!clientes.existsById(n.clienteId())) throw new NoEncontrado("El cliente no existe.");
        Cotizacion c = new Cotizacion();
        c.setClienteId(n.clienteId());
        c.setUsuarioId(usuario.id());
        c.setFecha(LocalDate.now());
        c.setVigencia(n.vigencia());
        BigDecimal total = BigDecimal.ZERO;
        for (NuevaLinea l : n.lineas()) {
            DetalleCotizacion d = new DetalleCotizacion();
            d.setProductoId(l.productoId());
            d.setCantidad(l.cantidad());
            d.setPrecioUnitario(l.precioUnitario());
            c.getDetalles().add(d);
            total = total.add(l.precioUnitario().multiply(BigDecimal.valueOf(l.cantidad())));
        }
        c.setTotal(total);
        return CotizacionDto.de(cotizaciones.save(c));
    }

    @PostMapping("/cotizaciones/{id}/rechazar")
    @PreAuthorize("hasAuthority('ventas:editar')")
    @Transactional
    public CotizacionDto rechazar(@PathVariable Long id) {
        Cotizacion c = cotizaciones.bloquear(id).orElseThrow(() -> new NoEncontrado("La cotización no existe."));
        if (c.getEstado() != EstadoCotizacion.enviada) throw new ReglaNegocio("La cotización ya no está abierta.");
        c.setEstado(EstadoCotizacion.rechazada);
        return CotizacionDto.de(c);
    }

    @PostMapping("/cotizaciones/{id}/pedido")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ventas:editar')")
    @Transactional
    public PedidoDto convertir(@PathVariable Long id) {
        Cotizacion c = cotizaciones.bloquear(id).orElseThrow(() -> new NoEncontrado("La cotización no existe."));
        if (c.getEstado() != EstadoCotizacion.enviada) throw new ReglaNegocio("La cotización ya no está abierta.");
        c.setEstado(EstadoCotizacion.aceptada);
        List<NuevaLinea> lineas = c.getDetalles().stream()
                .map(d -> new NuevaLinea(d.getProductoId(), d.getCantidad(), d.getPrecioUnitario())).toList();
        return PedidoDto.de(abrirPedido(c.getClienteId(), c.getId(), lineas));
    }

    @GetMapping("/pedidos")
    @PreAuthorize("hasAuthority('ventas:ver')")
    public List<PedidoDto> pedidos() {
        return pedidos.findAllByOrderByIdDesc().stream().map(PedidoDto::de).toList();
    }

    @PostMapping("/pedidos")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ventas:editar')")
    @Transactional
    public PedidoDto crearPedido(@Valid @RequestBody NuevoPedido n) {
        if (!clientes.existsById(n.clienteId())) throw new NoEncontrado("El cliente no existe.");
        return PedidoDto.de(abrirPedido(n.clienteId(), null, n.lineas()));
    }

    private Pedido abrirPedido(Long clienteId, Long cotizacionId, List<NuevaLinea> lineas) {
        Pedido p = new Pedido();
        p.setClienteId(clienteId);
        p.setCotizacionId(cotizacionId);
        p.setFecha(LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS));
        for (NuevaLinea l : lineas) {
            DetallePedido d = new DetallePedido();
            d.setProductoId(l.productoId());
            d.setCantidad(l.cantidad());
            d.setPrecioUnitario(l.precioUnitario());
            p.getDetalles().add(d);
        }
        pedidos.saveAndFlush(p);
        lineas.stream().sorted(Comparator.comparing(NuevaLinea::productoId))
                .forEach(l -> existencias.salidaVenta(l.productoId(), l.cantidad(), doc(p.getId())));
        return p;
    }

    @PostMapping("/pedidos/{id}/preparar")
    @PreAuthorize("hasAuthority('ventas:editar')")
    @Transactional
    public PedidoDto preparar(@PathVariable Long id) {
        Pedido p = bloquearPedido(id);
        if (p.getEstado() != EstadoPedido.confirmado) throw new ReglaNegocio("El pedido no está confirmado.");
        p.setEstado(EstadoPedido.en_preparacion);
        return PedidoDto.de(p);
    }

    @PostMapping("/pedidos/{id}/cancelar")
    @PreAuthorize("hasAuthority('ventas:editar')")
    @Transactional
    public PedidoDto cancelar(@PathVariable Long id) {
        Pedido p = bloquearPedido(id);
        if (!p.abierto()) throw new ReglaNegocio("Solo se cancelan pedidos sin facturar.");
        p.setEstado(EstadoPedido.cancelado);
        p.getDetalles().stream().sorted(Comparator.comparing(DetallePedido::getProductoId))
                .forEach(d -> existencias.devolucionVenta(d.getProductoId(), d.getCantidad(), doc(id)));
        return PedidoDto.de(p);
    }

    @PostMapping("/pedidos/{id}/factura")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ventas:editar')")
    @Transactional
    public FacturaDto facturar(@PathVariable Long id) {
        Pedido p = bloquearPedido(id);
        if (!p.abierto()) throw new ReglaNegocio("El pedido no se puede facturar.");
        BigDecimal subtotal = p.getDetalles().stream()
                .map(d -> d.getPrecioUnitario().multiply(BigDecimal.valueOf(d.getCantidad())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal impuestos = subtotal.multiply(TASA_IVA).setScale(2, RoundingMode.HALF_UP);
        Factura f = new Factura();
        f.setPedidoId(id);
        f.setNumero(String.format("FAC-%04d", facturas.siguienteNumero()));
        f.setFecha(LocalDate.now());
        f.setSubtotal(subtotal);
        f.setImpuestos(impuestos);
        f.setTotal(subtotal.add(impuestos));
        p.setEstado(EstadoPedido.facturado);
        return FacturaDto.de(facturas.save(f));
    }

    private Pedido bloquearPedido(Long id) {
        return pedidos.bloquear(id).orElseThrow(() -> new NoEncontrado("El pedido no existe."));
    }

    @GetMapping("/facturas")
    @PreAuthorize("hasAuthority('ventas:ver')")
    public List<FacturaDto> facturas() {
        return facturas.findAllByOrderByIdDesc().stream().map(FacturaDto::de).toList();
    }

    @PostMapping("/facturas/{id}/pagada")
    @PreAuthorize("hasAuthority('ventas:editar')")
    @Transactional
    public FacturaDto marcarPagada(@PathVariable Long id) {
        Factura f = facturas.findById(id).orElseThrow(() -> new NoEncontrado("La factura no existe."));
        f.setEstado(EstadoFactura.pagada);
        return FacturaDto.de(f);
    }
}

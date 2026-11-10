package co.edu.udistrital.novakey.compras;

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
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
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
enum EstadoOrdenCompra { enviada, parcial, recibida, cancelada }

enum EstadoCuenta { abierta, pagada }

@Entity
@Table(name = "proveedor")
@Getter
@Setter
class Proveedor {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_proveedor")
    private Long id;
    private String nit;
    @Column(name = "razon_social")
    private String razonSocial;
    private String contacto;
    private String email;
    private String telefono;
}

@Entity
@Table(name = "detalle_orden_compra")
@Getter
@Setter
class DetalleOrdenCompra {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_detalle_oc")
    private Long id;
    @Column(name = "id_material")
    private Long materialId;
    private BigDecimal cantidad;
    @Column(name = "cantidad_recibida")
    private BigDecimal cantidadRecibida = BigDecimal.ZERO;
    @Column(name = "precio_unitario")
    private BigDecimal precioUnitario;

    BigDecimal pendiente() {
        return cantidad.subtract(cantidadRecibida);
    }
}

@Entity
@Table(name = "orden_compra")
@Getter
@Setter
class OrdenCompra {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_orden_compra")
    private Long id;
    @Column(name = "id_proveedor")
    private Long proveedorId;
    @Column(name = "id_usuario")
    private Long usuarioId;
    private LocalDate fecha;
    @Enumerated(EnumType.STRING)
    private EstadoOrdenCompra estado = EstadoOrdenCompra.enviada;
    private BigDecimal total;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "id_orden_compra", nullable = false)
    @BatchSize(size = 50)
    private List<DetalleOrdenCompra> detalles = new ArrayList<>();
}

@Entity
@Table(name = "cuenta_por_pagar")
@Getter
@Setter
class CuentaPorPagar {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cxp")
    private Long id;
    @Column(name = "id_orden_compra")
    private Long ordenCompraId;
    private BigDecimal monto;
    private BigDecimal saldo;
    @Column(name = "fecha_vencimiento")
    private LocalDate fechaVencimiento;
    @Enumerated(EnumType.STRING)
    private EstadoCuenta estado = EstadoCuenta.abierta;
}

interface ProveedorRepo extends JpaRepository<Proveedor, Long> {
    boolean existsByNit(String nit);

    List<Proveedor> findAllByOrderById();
}

interface OrdenCompraRepo extends JpaRepository<OrdenCompra, Long> {
    List<OrdenCompra> findAllByOrderByIdDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from OrdenCompra o where o.id = :id")
    Optional<OrdenCompra> bloquear(@Param("id") Long id);
}

interface CuentaRepo extends JpaRepository<CuentaPorPagar, Long> {
    List<CuentaPorPagar> findAllByOrderById();

    Optional<CuentaPorPagar> findByOrdenCompraId(Long ordenCompraId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CuentaPorPagar c where c.id = :id")
    Optional<CuentaPorPagar> bloquear(@Param("id") Long id);
}

@RestController
@RequestMapping("/api")
class ComprasApi {

    private static final int DIAS_CREDITO = 30;

    public record ProveedorDto(Long id, String nit, String razonSocial, String contacto, String email, String telefono) {
        static ProveedorDto de(Proveedor p) {
            return new ProveedorDto(p.getId(), p.getNit(), p.getRazonSocial(), p.getContacto(), p.getEmail(), p.getTelefono());
        }
    }

    public record DetalleDto(Long id, Long materialId, BigDecimal cantidad, BigDecimal cantidadRecibida, BigDecimal precioUnitario) {}

    public record OrdenCompraDto(Long id, Long proveedorId, Long usuarioId, LocalDate fecha, EstadoOrdenCompra estado,
            BigDecimal total, List<DetalleDto> detalles) {
        static OrdenCompraDto de(OrdenCompra o) {
            return new OrdenCompraDto(o.getId(), o.getProveedorId(), o.getUsuarioId(), o.getFecha(), o.getEstado(), o.getTotal(),
                    o.getDetalles().stream()
                            .map(d -> new DetalleDto(d.getId(), d.getMaterialId(), d.getCantidad(), d.getCantidadRecibida(), d.getPrecioUnitario()))
                            .toList());
        }
    }

    public record CuentaDto(Long id, Long ordenCompraId, BigDecimal monto, BigDecimal saldo, LocalDate fechaVencimiento, EstadoCuenta estado) {
        static CuentaDto de(CuentaPorPagar c) {
            return new CuentaDto(c.getId(), c.getOrdenCompraId(), c.getMonto(), c.getSaldo(), c.getFechaVencimiento(), c.getEstado());
        }
    }

    public record NuevoProveedor(@NotBlank(message = "El NIT es obligatorio.") String nit,
            @NotBlank(message = "La razón social es obligatoria.") String razonSocial,
            String contacto, String email, String telefono) {}

    public record NuevaLinea(@NotNull(message = "Selecciona un material.") Long materialId,
            @NotNull(message = "La cantidad debe ser mayor que cero.") @Positive(message = "La cantidad debe ser mayor que cero.") BigDecimal cantidad,
            @NotNull(message = "El precio debe ser mayor que cero.") @Positive(message = "El precio debe ser mayor que cero.") BigDecimal precioUnitario) {}

    public record NuevaOrden(@NotNull(message = "Selecciona un proveedor.") Long proveedorId,
            @NotEmpty(message = "La orden necesita al menos una línea.") List<@Valid NuevaLinea> lineas) {}

    public record Recepcion(@NotEmpty(message = "Indica al menos una cantidad recibida.") Map<Long, BigDecimal> cantidades) {}

    public record Pago(@NotNull(message = "El pago debe ser mayor que cero.") @Positive(message = "El pago debe ser mayor que cero.") BigDecimal monto) {}

    private final ProveedorRepo proveedores;
    private final OrdenCompraRepo ordenes;
    private final CuentaRepo cuentas;
    private final Existencias existencias;
    private final UsuarioActual usuario;

    ComprasApi(ProveedorRepo proveedores, OrdenCompraRepo ordenes, CuentaRepo cuentas, Existencias existencias, UsuarioActual usuario) {
        this.proveedores = proveedores;
        this.ordenes = ordenes;
        this.cuentas = cuentas;
        this.existencias = existencias;
        this.usuario = usuario;
    }

    @GetMapping("/proveedores")
    @PreAuthorize("hasAuthority('compras:ver')")
    public List<ProveedorDto> proveedores() {
        return proveedores.findAllByOrderById().stream().map(ProveedorDto::de).toList();
    }

    @PostMapping("/proveedores")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('compras:editar')")
    @Transactional
    public ProveedorDto crearProveedor(@Valid @RequestBody NuevoProveedor n) {
        String nit = n.nit().trim();
        if (proveedores.existsByNit(nit)) throw new ReglaNegocio("Ya existe un proveedor con ese NIT.");
        Proveedor p = new Proveedor();
        p.setNit(nit);
        p.setRazonSocial(n.razonSocial().trim());
        p.setContacto(n.contacto());
        p.setEmail(n.email());
        p.setTelefono(n.telefono());
        return ProveedorDto.de(proveedores.save(p));
    }

    @GetMapping("/ordenes-compra")
    @PreAuthorize("hasAuthority('compras:ver')")
    public List<OrdenCompraDto> ordenes() {
        return ordenes.findAllByOrderByIdDesc().stream().map(OrdenCompraDto::de).toList();
    }

    @PostMapping("/ordenes-compra")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('compras:editar')")
    @Transactional
    public OrdenCompraDto crearOrden(@Valid @RequestBody NuevaOrden n) {
        if (!proveedores.existsById(n.proveedorId())) throw new NoEncontrado("El proveedor no existe.");
        OrdenCompra o = new OrdenCompra();
        o.setProveedorId(n.proveedorId());
        o.setUsuarioId(usuario.id());
        o.setFecha(LocalDate.now());
        BigDecimal total = BigDecimal.ZERO;
        for (NuevaLinea l : n.lineas()) {
            DetalleOrdenCompra d = new DetalleOrdenCompra();
            d.setMaterialId(l.materialId());
            d.setCantidad(l.cantidad());
            d.setPrecioUnitario(l.precioUnitario());
            o.getDetalles().add(d);
            total = total.add(l.cantidad().multiply(l.precioUnitario()));
        }
        o.setTotal(total);
        return OrdenCompraDto.de(ordenes.save(o));
    }

    /** Suma existencias, actualiza la orden y lleva lo recibido a su cuenta por pagar, todo o nada. */
    @PostMapping("/ordenes-compra/{id}/recepciones")
    @PreAuthorize("hasAuthority('compras:editar')")
    @Transactional
    public OrdenCompraDto recibir(@PathVariable Long id, @Valid @RequestBody Recepcion r) {
        OrdenCompra o = ordenes.bloquear(id).orElseThrow(() -> new NoEncontrado("La orden no existe."));
        if (o.getEstado() == EstadoOrdenCompra.recibida || o.getEstado() == EstadoOrdenCompra.cancelada) {
            throw new ReglaNegocio("La orden no admite recepciones.");
        }
        String ref = String.format("OC-%04d", id);
        BigDecimal valor = BigDecimal.ZERO;
        List<DetalleOrdenCompra> lineas = o.getDetalles().stream()
                .sorted(Comparator.comparing(DetalleOrdenCompra::getMaterialId)).toList();
        for (DetalleOrdenCompra d : lineas) {
            BigDecimal cantidad = r.cantidades().getOrDefault(d.getId(), BigDecimal.ZERO);
            if (cantidad.signum() < 0 || cantidad.compareTo(d.pendiente()) > 0) {
                throw new ReglaNegocio("La cantidad recibida supera lo pendiente (" + d.pendiente().stripTrailingZeros().toPlainString() + ").");
            }
            if (cantidad.signum() == 0) continue;
            d.setCantidadRecibida(d.getCantidadRecibida().add(cantidad));
            valor = valor.add(cantidad.multiply(d.getPrecioUnitario()));
            existencias.entradaCompra(d.getMaterialId(), cantidad, ref);
        }
        if (valor.signum() == 0) throw new ReglaNegocio("Indica al menos una cantidad recibida.");
        o.setEstado(o.getDetalles().stream().allMatch(d -> d.pendiente().signum() == 0)
                ? EstadoOrdenCompra.recibida : EstadoOrdenCompra.parcial);

        CuentaPorPagar cuenta = cuentas.findByOrdenCompraId(id).orElseGet(() -> {
            CuentaPorPagar c = new CuentaPorPagar();
            c.setOrdenCompraId(id);
            c.setMonto(BigDecimal.ZERO);
            c.setSaldo(BigDecimal.ZERO);
            c.setFechaVencimiento(LocalDate.now().plusDays(DIAS_CREDITO));
            return c;
        });
        cuenta.setMonto(cuenta.getMonto().add(valor));
        cuenta.setSaldo(cuenta.getSaldo().add(valor));
        cuenta.setEstado(EstadoCuenta.abierta);
        cuentas.save(cuenta);
        return OrdenCompraDto.de(o);
    }

    @GetMapping("/cuentas-por-pagar")
    @PreAuthorize("hasAuthority('compras:ver')")
    public List<CuentaDto> cuentas() {
        return cuentas.findAllByOrderById().stream().map(CuentaDto::de).toList();
    }

    @PostMapping("/cuentas-por-pagar/{id}/pagos")
    @PreAuthorize("hasAuthority('compras:editar')")
    @Transactional
    public CuentaDto pagar(@PathVariable Long id, @Valid @RequestBody Pago p) {
        CuentaPorPagar c = cuentas.bloquear(id).orElseThrow(() -> new NoEncontrado("La cuenta no existe."));
        if (p.monto().compareTo(c.getSaldo()) > 0) throw new ReglaNegocio("El pago no puede superar el saldo.");
        c.setSaldo(c.getSaldo().subtract(p.monto()));
        if (c.getSaldo().signum() == 0) c.setEstado(EstadoCuenta.pagada);
        return CuentaDto.de(c);
    }
}

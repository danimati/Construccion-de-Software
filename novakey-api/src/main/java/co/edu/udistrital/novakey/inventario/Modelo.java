package co.edu.udistrital.novakey.inventario;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.LockModeType;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

// Los valores coinciden en minúsculas con el ENUM del diagrama ER y con el JSON de la API.
enum EstadoOrdenProduccion { planeada, en_proceso, terminada, cancelada }

enum ResultadoCalidad { aprobada, rechazada }

enum TipoMovimiento { entrada_compra, salida_produccion, entrada_produccion, salida_venta, devolucion_venta, ajuste }

@Entity
@Table(name = "material")
@Getter
@Setter
class Material {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_material")
    private Long id;
    private String codigo;
    private String nombre;
    @Column(name = "unidad_medida")
    private String unidadMedida;
    @Column(name = "stock_actual")
    private BigDecimal stockActual;
    @Column(name = "stock_minimo")
    private BigDecimal stockMinimo;
    @Column(name = "costo_unitario")
    private BigDecimal costoUnitario;
}

@Entity
@Table(name = "producto")
@Getter
@Setter
class Producto {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_producto")
    private Long id;
    private String sku;
    private String nombre;
    @Column(name = "precio_venta")
    private BigDecimal precioVenta;
    @Column(name = "stock_actual")
    private int stockActual;
    private boolean activo;
}

@EqualsAndHashCode
class LineaMaterialId implements Serializable {
    Long productoId;
    Long materialId;
}

@Entity
@Table(name = "lista_materiales")
@IdClass(LineaMaterialId.class)
@Getter
@Setter
class LineaMaterial {
    @Id
    @Column(name = "id_producto")
    private Long productoId;
    @Id
    @Column(name = "id_material")
    private Long materialId;
    private BigDecimal cantidad;
}

@Entity
@Table(name = "orden_produccion")
@Getter
@Setter
class OrdenProduccion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_orden_produccion")
    private Long id;
    @Column(name = "id_producto")
    private Long productoId;
    @Column(name = "id_usuario")
    private Long usuarioId;
    private int cantidad;
    @Column(name = "fecha_inicio")
    private LocalDate fechaInicio;
    @Column(name = "fecha_fin")
    private LocalDate fechaFin;
    @Enumerated(EnumType.STRING)
    private EstadoOrdenProduccion estado = EstadoOrdenProduccion.planeada;
    @JdbcTypeCode(SqlTypes.ARRAY)
    private int[] avance = new int[6];
}

@Entity
@Table(name = "consumo_material")
@Getter
@Setter
class ConsumoMaterial {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_consumo")
    private Long id;
    @Column(name = "id_orden_produccion")
    private Long ordenProduccionId;
    @Column(name = "id_material")
    private Long materialId;
    private BigDecimal cantidad;
    private LocalDateTime fecha;
}

@Entity
@Table(name = "unidad_producida")
@Getter
@Setter
class UnidadProducida {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_unidad")
    private Long id;
    @Column(name = "id_orden_produccion")
    private Long ordenProduccionId;
    @Column(name = "id_detalle_pedido")
    private Long detallePedidoId;
    @Column(name = "numero_serie")
    private String numeroSerie;
    @Enumerated(EnumType.STRING)
    @Column(name = "resultado_calidad")
    private ResultadoCalidad resultadoCalidad;
    @Column(name = "fecha_ensamblaje")
    private LocalDateTime fechaEnsamblaje;
}

@Entity
@Table(name = "movimiento_inventario")
@Getter
@Setter
class MovimientoInventario {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_movimiento")
    private Long id;
    @Column(name = "id_material")
    private Long materialId;
    @Column(name = "id_producto")
    private Long productoId;
    @Column(name = "id_usuario")
    private Long usuarioId;
    @Enumerated(EnumType.STRING)
    private TipoMovimiento tipo;
    private BigDecimal cantidad;
    @Column(name = "documento_ref")
    private String documentoRef;
    private LocalDateTime fecha;
}

interface MaterialRepo extends JpaRepository<Material, Long> {
    List<Material> findAllByOrderById();

    /** Bloquea la fila hasta terminar la transacción para que dos operaciones no vendan el mismo stock. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Material m where m.id = :id")
    Optional<Material> bloquear(@Param("id") Long id);
}

interface ProductoRepo extends JpaRepository<Producto, Long> {
    List<Producto> findAllByOrderById();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Producto p where p.id = :id")
    Optional<Producto> bloquear(@Param("id") Long id);
}

interface LineaMaterialRepo extends JpaRepository<LineaMaterial, LineaMaterialId> {
    List<LineaMaterial> findByProductoIdOrderByMaterialId(Long productoId);

    boolean existsByProductoId(Long productoId);
}

interface OrdenProduccionRepo extends JpaRepository<OrdenProduccion, Long> {
    List<OrdenProduccion> findAllByOrderByIdDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from OrdenProduccion o where o.id = :id")
    Optional<OrdenProduccion> bloquear(@Param("id") Long id);
}

interface ConsumoRepo extends JpaRepository<ConsumoMaterial, Long> {}

interface UnidadRepo extends JpaRepository<UnidadProducida, Long> {
    long countByOrdenProduccionIdAndResultadoCalidad(Long ordenId, ResultadoCalidad resultado);

    @Query(value = "select nextval('numero_serie_seq')", nativeQuery = true)
    long siguienteSerie();
}

interface MovimientoRepo extends JpaRepository<MovimientoInventario, Long> {
    List<MovimientoInventario> findAllByOrderByIdDesc(Limit limite);
}

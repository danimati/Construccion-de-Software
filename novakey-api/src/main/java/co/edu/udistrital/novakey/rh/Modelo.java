package co.edu.udistrital.novakey.rh;

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
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;
import org.springframework.data.jpa.repository.JpaRepository;

// Los valores coinciden en minúsculas con el ENUM del diagrama ER y con el JSON de la API.
enum EstadoEmpleado { activo, vacaciones, retirado }

enum EstadoNomina { borrador, pagada }

@Entity
@Table(name = "area")
@Getter
@Setter
class Area {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_area")
    private Long id;
    private String nombre;
}

@Entity
@Table(name = "cargo")
@Getter
@Setter
class Cargo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cargo")
    private Long id;
    @Column(name = "id_area")
    private Long areaId;
    private String nombre;
    @Column(name = "salario_base")
    private BigDecimal salarioBase;
}

@Entity
@Table(name = "empleado")
@Getter
@Setter
class Empleado {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_empleado")
    private Long id;
    @Column(name = "id_cargo")
    private Long cargoId;
    private String documento;
    private String nombres;
    private String apellidos;
    private String email;
    private String telefono;
    @Column(name = "fecha_ingreso")
    private LocalDate fechaIngreso;
    @Enumerated(EnumType.STRING)
    private EstadoEmpleado estado = EstadoEmpleado.activo;
}

@Entity
@Table(name = "horario")
@Getter
@Setter
class Horario {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_horario")
    private Long id;
    @Column(name = "id_empleado")
    private Long empleadoId;
    @Column(name = "dia_semana")
    private short diaSemana;
    @Column(name = "hora_inicio")
    private LocalTime horaInicio;
    @Column(name = "hora_fin")
    private LocalTime horaFin;
}

@Entity
@Table(name = "detalle_nomina")
@Getter
@Setter
class DetalleNomina {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_detalle_nomina")
    private Long id;
    @Column(name = "id_empleado")
    private Long empleadoId;
    @Column(name = "salario_base")
    private BigDecimal salarioBase;
    private BigDecimal devengados;
    private BigDecimal deducciones;
    @Column(name = "neto_pagar")
    private BigDecimal netoPagar;
}

@Entity
@Table(name = "nomina")
@Getter
@Setter
class Nomina {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_nomina")
    private Long id;
    @Column(name = "periodo_inicio")
    private LocalDate periodoInicio;
    @Column(name = "periodo_fin")
    private LocalDate periodoFin;
    @Column(name = "fecha_pago")
    private LocalDate fechaPago;
    @Enumerated(EnumType.STRING)
    private EstadoNomina estado = EstadoNomina.borrador;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "id_nomina", nullable = false)
    @BatchSize(size = 50)
    private List<DetalleNomina> detalles = new ArrayList<>();
}

interface AreaRepo extends JpaRepository<Area, Long> {}

interface CargoRepo extends JpaRepository<Cargo, Long> {}

interface EmpleadoRepo extends JpaRepository<Empleado, Long> {
    boolean existsByDocumento(String documento);

    List<Empleado> findAllByOrderById();

    List<Empleado> findByEstadoNot(EstadoEmpleado estado);
}

interface HorarioRepo extends JpaRepository<Horario, Long> {}

interface NominaRepo extends JpaRepository<Nomina, Long> {
    List<Nomina> findAllByOrderByIdDesc();

    boolean existsByEstado(EstadoNomina estado);
}

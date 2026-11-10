package co.edu.udistrital.novakey.rh;

import co.edu.udistrital.novakey.comun.Errores.NoEncontrado;
import co.edu.udistrital.novakey.comun.Errores.ReglaNegocio;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
class RhApi implements ConsultaEmpleados {

    /** Salud 4 % + pensión 4 % sobre el salario base. Simplificación, no liquidación legal completa. */
    private static final BigDecimal TASA_DEDUCCION = new BigDecimal("0.08");

    public record AreaDto(Long id, String nombre) {}

    public record CargoDto(Long id, Long areaId, String nombre, BigDecimal salarioBase) {}

    public record EmpleadoDto(Long id, Long cargoId, String documento, String nombres, String apellidos, String email,
            String telefono, LocalDate fechaIngreso, EstadoEmpleado estado) {
        static EmpleadoDto de(Empleado e) {
            return new EmpleadoDto(e.getId(), e.getCargoId(), e.getDocumento(), e.getNombres(), e.getApellidos(),
                    e.getEmail(), e.getTelefono(), e.getFechaIngreso(), e.getEstado());
        }
    }

    /** Lo mínimo que necesita Accesos: sin documento, contacto ni datos laborales. */
    public record EmpleadoResumen(Long id, String nombres, String apellidos) {}

    public record HorarioDto(Long id, Long empleadoId, short diaSemana, LocalTime horaInicio, LocalTime horaFin) {}

    public record DetalleNominaDto(Long id, Long empleadoId, BigDecimal salarioBase, BigDecimal devengados,
            BigDecimal deducciones, BigDecimal netoPagar) {}

    public record NominaDto(Long id, LocalDate periodoInicio, LocalDate periodoFin, LocalDate fechaPago,
            EstadoNomina estado, List<DetalleNominaDto> detalles) {
        static NominaDto de(Nomina n) {
            return new NominaDto(n.getId(), n.getPeriodoInicio(), n.getPeriodoFin(), n.getFechaPago(), n.getEstado(),
                    n.getDetalles().stream()
                            .map(d -> new DetalleNominaDto(d.getId(), d.getEmpleadoId(), d.getSalarioBase(),
                                    d.getDevengados(), d.getDeducciones(), d.getNetoPagar()))
                            .toList());
        }
    }

    public record NuevoEmpleado(
            @NotNull(message = "El cargo es obligatorio.") Long cargoId,
            @NotBlank(message = "El documento es obligatorio.") String documento,
            @NotBlank(message = "Los nombres son obligatorios.") String nombres,
            @NotBlank(message = "Los apellidos son obligatorios.") String apellidos,
            String email,
            String telefono,
            @NotNull(message = "La fecha de ingreso es obligatoria.") LocalDate fechaIngreso,
            @NotNull(message = "La hora de entrada es obligatoria.") LocalTime horaInicio,
            @NotNull(message = "La hora de salida es obligatoria.") LocalTime horaFin) {}

    public record CambioEstado(@NotNull EstadoEmpleado estado) {}

    public record CambioDevengados(@NotNull(message = "Los devengados no pueden ser negativos.") @PositiveOrZero(message = "Los devengados no pueden ser negativos.") BigDecimal devengados) {}

    private final AreaRepo areas;
    private final CargoRepo cargos;
    private final EmpleadoRepo empleados;
    private final HorarioRepo horarios;
    private final NominaRepo nominas;

    RhApi(AreaRepo areas, CargoRepo cargos, EmpleadoRepo empleados, HorarioRepo horarios, NominaRepo nominas) {
        this.areas = areas;
        this.cargos = cargos;
        this.empleados = empleados;
        this.horarios = horarios;
        this.nominas = nominas;
    }

    @Override
    public Optional<String> nombreCompleto(Long empleadoId) {
        return empleados.findById(empleadoId).map(e -> e.getNombres() + " " + e.getApellidos());
    }

    @GetMapping("/areas")
    @PreAuthorize("hasAuthority('rh:ver')")
    public List<AreaDto> areas() {
        return areas.findAll().stream().map(a -> new AreaDto(a.getId(), a.getNombre())).toList();
    }

    @GetMapping("/cargos")
    @PreAuthorize("hasAuthority('rh:ver')")
    public List<CargoDto> cargos() {
        return cargos.findAll().stream()
                .map(c -> new CargoDto(c.getId(), c.getAreaId(), c.getNombre(), c.getSalarioBase())).toList();
    }

    @GetMapping("/empleados")
    @PreAuthorize("hasAuthority('rh:ver')")
    public List<EmpleadoDto> empleados() {
        return empleados.findAllByOrderById().stream().map(EmpleadoDto::de).toList();
    }

    @GetMapping("/empleados/resumen")
    @PreAuthorize("hasAnyAuthority('rh:ver', 'accesos:ver')")
    public List<EmpleadoResumen> resumen() {
        return empleados.findAllByOrderById().stream()
                .map(e -> new EmpleadoResumen(e.getId(), e.getNombres(), e.getApellidos())).toList();
    }

    @PostMapping("/empleados")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('rh:editar')")
    @Transactional
    public EmpleadoDto crearEmpleado(@Valid @RequestBody NuevoEmpleado n) {
        if (!n.horaInicio().isBefore(n.horaFin())) throw new ReglaNegocio("La hora de inicio debe ser anterior a la de fin.");
        String documento = n.documento().trim();
        if (empleados.existsByDocumento(documento)) throw new ReglaNegocio("Ya existe un empleado con ese documento.");
        if (!cargos.existsById(n.cargoId())) throw new NoEncontrado("El cargo no existe.");
        Empleado e = new Empleado();
        e.setCargoId(n.cargoId());
        e.setDocumento(documento);
        e.setNombres(n.nombres().trim());
        e.setApellidos(n.apellidos().trim());
        e.setEmail(n.email());
        e.setTelefono(n.telefono());
        e.setFechaIngreso(n.fechaIngreso());
        empleados.save(e);
        for (short dia = 1; dia <= 5; dia++) {
            Horario h = new Horario();
            h.setEmpleadoId(e.getId());
            h.setDiaSemana(dia);
            h.setHoraInicio(n.horaInicio());
            h.setHoraFin(n.horaFin());
            horarios.save(h);
        }
        return EmpleadoDto.de(e);
    }

    @PutMapping("/empleados/{id}/estado")
    @PreAuthorize("hasAuthority('rh:editar')")
    @Transactional
    public EmpleadoDto cambiarEstado(@PathVariable Long id, @Valid @RequestBody CambioEstado c) {
        Empleado e = empleados.findById(id).orElseThrow(() -> new NoEncontrado("El empleado no existe."));
        e.setEstado(c.estado());
        return EmpleadoDto.de(e);
    }

    @GetMapping("/horarios")
    @PreAuthorize("hasAuthority('rh:ver')")
    public List<HorarioDto> horarios() {
        return horarios.findAll().stream()
                .map(h -> new HorarioDto(h.getId(), h.getEmpleadoId(), h.getDiaSemana(), h.getHoraInicio(), h.getHoraFin()))
                .toList();
    }

    @GetMapping("/nominas")
    @PreAuthorize("hasAuthority('rh:ver')")
    public List<NominaDto> nominas() {
        return nominas.findAllByOrderByIdDesc().stream().map(NominaDto::de).toList();
    }

    /** Genera en borrador la nómina del mes siguiente al último liquidado. */
    @PostMapping("/nominas")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('rh:editar')")
    @Transactional
    public NominaDto generarNomina() {
        if (nominas.existsByEstado(EstadoNomina.borrador)) {
            throw new ReglaNegocio("Paga la nómina en borrador antes de generar otra.");
        }
        YearMonth mes = nominas.findAllByOrderByIdDesc().stream().findFirst()
                .map(n -> YearMonth.from(n.getPeriodoFin()).plusMonths(1))
                .orElse(YearMonth.now());
        Nomina n = new Nomina();
        n.setPeriodoInicio(mes.atDay(1));
        n.setPeriodoFin(mes.atEndOfMonth());
        n.setFechaPago(mes.atEndOfMonth());
        for (Empleado e : empleados.findByEstadoNot(EstadoEmpleado.retirado)) {
            BigDecimal salario = cargos.findById(e.getCargoId()).orElseThrow().getSalarioBase();
            BigDecimal deducciones = salario.multiply(TASA_DEDUCCION).setScale(2, RoundingMode.HALF_UP);
            DetalleNomina d = new DetalleNomina();
            d.setEmpleadoId(e.getId());
            d.setSalarioBase(salario);
            d.setDevengados(BigDecimal.ZERO);
            d.setDeducciones(deducciones);
            d.setNetoPagar(salario.subtract(deducciones));
            n.getDetalles().add(d);
        }
        return NominaDto.de(nominas.save(n));
    }

    @PutMapping("/nominas/{id}/detalles/{detalleId}/devengados")
    @PreAuthorize("hasAuthority('rh:editar')")
    @Transactional
    public NominaDto fijarDevengados(@PathVariable Long id, @PathVariable Long detalleId,
            @Valid @RequestBody CambioDevengados c) {
        Nomina n = nominas.findById(id).orElseThrow(() -> new NoEncontrado("La nómina no existe."));
        if (n.getEstado() != EstadoNomina.borrador) throw new ReglaNegocio("Solo se edita una nómina en borrador.");
        DetalleNomina d = n.getDetalles().stream().filter(x -> x.getId().equals(detalleId)).findFirst()
                .orElseThrow(() -> new NoEncontrado("Detalle no encontrado."));
        d.setDevengados(c.devengados());
        d.setNetoPagar(d.getSalarioBase().add(c.devengados()).subtract(d.getDeducciones()));
        return NominaDto.de(n);
    }

    @PostMapping("/nominas/{id}/pagar")
    @PreAuthorize("hasAuthority('rh:editar')")
    @Transactional
    public NominaDto pagarNomina(@PathVariable Long id) {
        Nomina n = nominas.findById(id).orElseThrow(() -> new NoEncontrado("La nómina no existe."));
        if (n.getEstado() != EstadoNomina.borrador) throw new ReglaNegocio("La nómina no está en borrador.");
        n.setEstado(EstadoNomina.pagada);
        n.setFechaPago(LocalDate.now());
        return NominaDto.de(n);
    }
}

package co.edu.udistrital.novakey.iam;

import co.edu.udistrital.novakey.comun.Errores.NoEncontrado;
import co.edu.udistrital.novakey.comun.Errores.ReglaNegocio;
import co.edu.udistrital.novakey.rh.ConsultaEmpleados;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
class IamApi {

    static final long ROL_ADMIN_ID = 6;
    private static final List<String> MODULOS = List.of("ventas", "inventario", "produccion", "compras", "rh", "accesos");

    public record Credenciales(@NotBlank String username, @NotBlank String password) {}

    public record SesionDto(Long id, String username, String nombre, List<String> roles, Map<String, String> permisos) {}

    public record LoginDto(String token, Instant expira, SesionDto usuario) {}

    public record UsuarioDto(Long id, Long empleadoId, String username, String email, boolean activo, List<Long> rolIds) {
        static UsuarioDto de(Usuario u) {
            return new UsuarioDto(u.getId(), u.getEmpleadoId(), u.getUsername(), u.getEmail(), u.isActivo(),
                    u.getRoles().stream().map(Rol::getId).sorted().toList());
        }
    }

    public record RolDto(Long id, String nombre, String descripcion, Map<String, String> permisos) {
        static RolDto de(Rol r) {
            return new RolDto(r.getId(), r.getNombre(), r.getDescripcion(), niveles(
                    r.getPermisos().stream().map(Permiso::getCodigo).collect(Collectors.toSet())));
        }
    }

    public record NuevoUsuario(
            @NotBlank(message = "El usuario es obligatorio.") @Size(max = 50) String username,
            @NotBlank(message = "El correo es obligatorio.") @Email(message = "El correo no es válido.") String email,
            @NotBlank(message = "La contraseña es obligatoria.") @Size(min = 8, max = 128, message = "La contraseña debe tener al menos 8 caracteres.") String password,
            Long empleadoId,
            @NotNull(message = "El rol es obligatorio.") Long rolId) {}

    public record CambioRol(@NotNull Long rolId) {}

    public record CambioActivo(@NotNull Boolean activo) {}

    public record CambioPermiso(@Pattern(regexp = "ver|editar", message = "Nivel no válido.") String nivel) {}

    private final UsuarioRepo usuarios;
    private final RolRepo roles;
    private final PermisoRepo permisos;
    private final PasswordEncoder codificador;
    private final JwtEncoder jwt;
    private final UsuarioActual actual;
    private final ConsultaEmpleados empleados;
    private final long horasToken;
    private final String hashSeñuelo;

    IamApi(UsuarioRepo usuarios, RolRepo roles, PermisoRepo permisos, PasswordEncoder codificador, JwtEncoder jwt,
            UsuarioActual actual, ConsultaEmpleados empleados, @Value("${novakey.jwt.horas}") long horasToken) {
        this.usuarios = usuarios;
        this.roles = roles;
        this.permisos = permisos;
        this.codificador = codificador;
        this.jwt = jwt;
        this.actual = actual;
        this.empleados = empleados;
        this.horasToken = horasToken;
        this.hashSeñuelo = codificador.encode("señuelo-para-igualar-tiempos");
    }

    /** {"ventas": "editar", "rh": null, ...} a partir de los códigos de permiso. */
    static Map<String, String> niveles(Collection<String> codigos) {
        Map<String, String> niveles = new HashMap<>();
        for (String modulo : MODULOS) {
            niveles.put(modulo, codigos.contains(modulo + ":editar") ? "editar"
                    : codigos.contains(modulo + ":ver") ? "ver" : null);
        }
        return niveles;
    }

    private SesionDto sesion(Usuario u) {
        String nombre = u.getEmpleadoId() == null ? u.getUsername()
                : empleados.nombreCompleto(u.getEmpleadoId()).orElse(u.getUsername());
        return new SesionDto(u.getId(), u.getUsername(), nombre,
                u.getRoles().stream().map(Rol::getNombre).sorted().toList(), niveles(u.codigosPermiso()));
    }

    @PostMapping("/auth/login")
    LoginDto login(@Valid @RequestBody Credenciales c) {
        Usuario usuario = usuarios.findByUsernameAndActivoTrue(c.username().trim()).orElse(null);
        // Con usuario inexistente también se verifica un hash, para que el tiempo de respuesta no lo delate.
        boolean valida = codificador.matches(c.password(), usuario == null ? hashSeñuelo : usuario.getPasswordHash());
        if (usuario == null || !valida) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario o contraseña incorrectos.");
        }
        Instant ahora = Instant.now();
        Instant expira = ahora.plus(horasToken, ChronoUnit.HOURS);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("novakey-api")
                .subject(String.valueOf(usuario.getId()))
                .issuedAt(ahora)
                .expiresAt(expira)
                .build();
        String token = jwt.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
        return new LoginDto(token, expira, sesion(usuario));
    }

    @GetMapping("/auth/me")
    SesionDto yo() {
        return usuarios.findById(actual.id()).map(this::sesion).orElseThrow(() -> new NoEncontrado("Usuario no encontrado."));
    }

    @GetMapping("/usuarios")
    @PreAuthorize("hasAuthority('accesos:ver')")
    public List<UsuarioDto> usuarios() {
        return usuarios.findAllByOrderById().stream().map(UsuarioDto::de).toList();
    }

    @PostMapping("/usuarios")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('accesos:editar')")
    @Transactional
    public UsuarioDto crearUsuario(@Valid @RequestBody NuevoUsuario n) {
        String username = n.username().trim();
        String email = n.email().trim();
        if (usuarios.existsByUsername(username)) throw new ReglaNegocio("Ese nombre de usuario ya existe.");
        if (usuarios.existsByEmail(email)) throw new ReglaNegocio("Ese correo ya está registrado.");
        Rol rol = roles.findById(n.rolId()).orElseThrow(() -> new NoEncontrado("El rol no existe."));
        Usuario u = new Usuario();
        u.setUsername(username);
        u.setEmail(email);
        u.setEmpleadoId(n.empleadoId());
        u.setPasswordHash(codificador.encode(n.password()));
        u.setRoles(Set.of(rol));
        return UsuarioDto.de(usuarios.save(u));
    }

    @PutMapping("/usuarios/{id}/rol")
    @PreAuthorize("hasAuthority('accesos:editar')")
    @Transactional
    public UsuarioDto cambiarRol(@PathVariable Long id, @Valid @RequestBody CambioRol c) {
        if (id.equals(actual.id())) throw new ReglaNegocio("No puedes cambiar tu propio rol.");
        Usuario u = usuarios.findById(id).orElseThrow(() -> new NoEncontrado("El usuario no existe."));
        u.setRoles(new java.util.HashSet<>(Set.of(
                roles.findById(c.rolId()).orElseThrow(() -> new NoEncontrado("El rol no existe.")))));
        return UsuarioDto.de(u);
    }

    @PutMapping("/usuarios/{id}/activo")
    @PreAuthorize("hasAuthority('accesos:editar')")
    @Transactional
    public UsuarioDto cambiarActivo(@PathVariable Long id, @Valid @RequestBody CambioActivo c) {
        if (id.equals(actual.id())) throw new ReglaNegocio("No puedes desactivar tu propio usuario.");
        Usuario u = usuarios.findById(id).orElseThrow(() -> new NoEncontrado("El usuario no existe."));
        u.setActivo(c.activo());
        return UsuarioDto.de(u);
    }

    @GetMapping("/roles")
    @PreAuthorize("hasAuthority('accesos:ver')")
    public List<RolDto> roles() {
        return roles.findAllByOrderById().stream().map(RolDto::de).toList();
    }

    /** Fija el nivel de un rol en un módulo. Un nivel nulo retira el acceso. */
    @PutMapping("/roles/{id}/permisos/{modulo}")
    @PreAuthorize("hasAuthority('accesos:editar')")
    @Transactional
    public RolDto fijarPermiso(@PathVariable Long id, @PathVariable String modulo, @Valid @RequestBody CambioPermiso c) {
        if (!MODULOS.contains(modulo)) throw new NoEncontrado("El módulo no existe.");
        if (id == ROL_ADMIN_ID && "accesos".equals(modulo)) {
            throw new ReglaNegocio("El administrador debe conservar la gestión de accesos.");
        }
        Rol rol = roles.findById(id).orElseThrow(() -> new NoEncontrado("El rol no existe."));
        rol.getPermisos().removeIf(p -> modulo.equals(p.getModulo()));
        if (c.nivel() != null) {
            permisos.findByModulo(modulo).stream()
                    .filter(p -> "editar".equals(c.nivel()) || p.getCodigo().endsWith(":ver"))
                    .forEach(rol.getPermisos()::add);
        }
        return RolDto.de(rol);
    }

    /** Crea el primer administrador de una instalación nueva. */
    @Service
    static class AdminInicial implements org.springframework.boot.ApplicationRunner {
        private final UsuarioRepo usuarios;
        private final RolRepo roles;
        private final PasswordEncoder codificador;
        private final String clave;

        AdminInicial(UsuarioRepo usuarios, RolRepo roles, PasswordEncoder codificador,
                @Value("${novakey.admin.clave}") String clave) {
            this.usuarios = usuarios;
            this.roles = roles;
            this.codificador = codificador;
            this.clave = clave;
        }

        @Override
        @Transactional
        public void run(org.springframework.boot.ApplicationArguments args) {
            if (clave.isBlank() || usuarios.count() > 0) return;
            Usuario admin = new Usuario();
            admin.setUsername("admin");
            admin.setEmail("admin@novakey.invalid");
            admin.setPasswordHash(codificador.encode(clave));
            admin.setRoles(Set.of(roles.findById(ROL_ADMIN_ID).orElseThrow()));
            usuarios.save(admin);
        }
    }
}

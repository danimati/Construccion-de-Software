package co.edu.udistrital.novakey.iam;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;
import org.springframework.data.jpa.repository.JpaRepository;

@Entity
@Table(name = "permiso")
@Getter
@Setter
class Permiso {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_permiso")
    private Long id;
    private String codigo;
    private String modulo;
    private String descripcion;
}

@Entity
@Table(name = "rol")
@Getter
@Setter
class Rol {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_rol")
    private Long id;
    private String nombre;
    private String descripcion;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "rol_permiso",
            joinColumns = @JoinColumn(name = "id_rol"),
            inverseJoinColumns = @JoinColumn(name = "id_permiso"))
    @BatchSize(size = 20)
    private Set<Permiso> permisos = new HashSet<>();
}

@Entity
@Table(name = "usuario")
@Getter
@Setter
class Usuario {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_usuario")
    private Long id;
    @Column(name = "id_empleado")
    private Long empleadoId;
    private String username;
    private String email;
    @Column(name = "password_hash")
    private String passwordHash;
    private boolean activo = true;
    @Column(name = "creado_en")
    private LocalDateTime creadoEn = LocalDateTime.now();

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "usuario_rol",
            joinColumns = @JoinColumn(name = "id_usuario"),
            inverseJoinColumns = @JoinColumn(name = "id_rol"))
    @BatchSize(size = 50)
    private Set<Rol> roles = new HashSet<>();

    /** Códigos de permiso, por ejemplo {@code ventas:editar}, reunidos de todos sus roles. */
    Set<String> codigosPermiso() {
        Set<String> codigos = new HashSet<>();
        roles.forEach(r -> r.getPermisos().forEach(p -> codigos.add(p.getCodigo())));
        return codigos;
    }
}

interface UsuarioRepo extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByUsernameAndActivoTrue(String username);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    List<Usuario> findAllByOrderById();
}

interface RolRepo extends JpaRepository<Rol, Long> {
    List<Rol> findAllByOrderById();
}

interface PermisoRepo extends JpaRepository<Permiso, Long> {
    List<Permiso> findByModulo(String modulo);
}

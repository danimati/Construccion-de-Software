package co.edu.udistrital.novakey.iam;

import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Solo existe con el perfil demo: en producción estos endpoints y usuarios no se crean. */
@RestController
@RequestMapping("/api/demo")
@Profile("demo")
class DatosDemo implements ApplicationRunner {

    static final String CLAVE = "novakey";

    public record AccesoDemo(String username, String rol, String password) {}

    private final DataSource fuente;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder codificador;
    private final UsuarioRepo usuarios;
    private final RolRepo roles;

    DatosDemo(DataSource fuente, JdbcTemplate jdbc, PasswordEncoder codificador, UsuarioRepo usuarios, RolRepo roles) {
        this.fuente = fuente;
        this.jdbc = jdbc;
        this.codificador = codificador;
        this.usuarios = usuarios;
        this.roles = roles;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (usuarios.count() == 0) reiniciar();
    }

    /** Devuelve la base a los datos de ejemplo. */
    @PostMapping("/reiniciar")
    public void reiniciar() {
        new ResourceDatabasePopulator(new ClassPathResource("db/demo/datos.sql")).execute(fuente);
        jdbc.update("UPDATE usuario SET password_hash = ?", codificador.encode(CLAVE));
    }

    /** Un acceso por rol, para los botones de la pantalla de inicio de sesión. */
    @GetMapping("/accesos")
    List<AccesoDemo> accesos() {
        List<AccesoDemo> accesos = new ArrayList<>();
        for (Rol rol : roles.findAllByOrderById()) {
            usuarios.findAllByOrderById().stream()
                    .filter(u -> u.isActivo() && u.getRoles().stream().anyMatch(r -> r.getId().equals(rol.getId())))
                    .findFirst()
                    .ifPresent(u -> accesos.add(new AccesoDemo(u.getUsername(), rol.getNombre(), CLAVE)));
        }
        return accesos;
    }
}

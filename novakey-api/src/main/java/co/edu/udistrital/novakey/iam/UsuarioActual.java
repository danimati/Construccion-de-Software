package co.edu.udistrital.novakey.iam;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/** Interfaz del módulo IAM para que los demás módulos registren quién hace cada operación. */
@Component
public class UsuarioActual {
    public Long id() {
        return Long.valueOf(SecurityContextHolder.getContext().getAuthentication().getName());
    }
}

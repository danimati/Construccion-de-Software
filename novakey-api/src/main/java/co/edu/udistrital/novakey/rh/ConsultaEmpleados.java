package co.edu.udistrital.novakey.rh;

import java.util.Optional;

/** Interfaz que Recursos Humanos ofrece a otros módulos. */
public interface ConsultaEmpleados {
    Optional<String> nombreCompleto(Long empleadoId);
}

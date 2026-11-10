package co.edu.udistrital.novakey.comun;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Traduce errores a respuestas RFC 9457; el campo {@code detail} se muestra tal cual al usuario. */
@RestControllerAdvice
public class Errores extends ResponseEntityExceptionHandler {

    /** Regla de negocio incumplida: stock insuficiente, estado que no admite la acción... */
    public static class ReglaNegocio extends RuntimeException {
        public ReglaNegocio(String mensaje) {
            super(mensaje);
        }
    }

    public static class NoEncontrado extends RuntimeException {
        public NoEncontrado(String mensaje) {
            super(mensaje);
        }
    }

    @ExceptionHandler(ReglaNegocio.class)
    ProblemDetail reglaNegocio(ReglaNegocio e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, e.getMessage());
    }

    @ExceptionHandler(NoEncontrado.class)
    ProblemDetail noEncontrado(NoEncontrado e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
    }

    /** Última línea de defensa: una restricción de la base rechazó la operación. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail integridad(DataIntegrityViolationException e) {
        logger.warn("Restricción de base de datos: " + e.getMostSpecificCause().getMessage());
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "La operación entra en conflicto con los datos existentes.");
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException e,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        String detalle = e.getBindingResult().getAllErrors().stream()
                .map(error -> error.getDefaultMessage())
                .sorted()
                .findFirst()
                .orElse("Datos no válidos.");
        return ResponseEntity.badRequest().body(ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, detalle));
    }
}

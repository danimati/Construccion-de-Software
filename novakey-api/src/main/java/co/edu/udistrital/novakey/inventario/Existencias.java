package co.edu.udistrital.novakey.inventario;

import co.edu.udistrital.novakey.comun.Errores.NoEncontrado;
import co.edu.udistrital.novakey.comun.Errores.ReglaNegocio;
import co.edu.udistrital.novakey.iam.UsuarioActual;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Interfaz que Inventario ofrece a Compras y Ventas. Se une a la transacción de quien llama, de modo
 * que un fallo deshace también el documento. Quien llama debe recorrer sus líneas ordenadas por id:
 * así todas las transacciones bloquean en el mismo orden y no se producen interbloqueos.
 */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class Existencias {

    private final MaterialRepo materiales;
    private final ProductoRepo productos;
    private final MovimientoRepo movimientos;
    private final UsuarioActual usuario;

    Existencias(MaterialRepo materiales, ProductoRepo productos, MovimientoRepo movimientos, UsuarioActual usuario) {
        this.materiales = materiales;
        this.productos = productos;
        this.movimientos = movimientos;
        this.usuario = usuario;
    }

    /** Compras: lo recibido se suma al material. */
    public void entradaCompra(Long materialId, BigDecimal cantidad, String documento) {
        Material m = materiales.bloquear(materialId).orElseThrow(() -> new NoEncontrado("Material no encontrado."));
        m.setStockActual(m.getStockActual().add(cantidad));
        registrar(materialId, null, TipoMovimiento.entrada_compra, cantidad, documento);
    }

    /** Ventas: descuenta el producto o rechaza la operación si no hay disponibilidad. */
    public void salidaVenta(Long productoId, int cantidad, String documento) {
        Producto p = productos.bloquear(productoId).orElseThrow(() -> new NoEncontrado("Producto no encontrado."));
        if (p.getStockActual() < cantidad) {
            throw new ReglaNegocio(p.getNombre() + ": disponibles " + p.getStockActual() + ", solicitadas " + cantidad + ".");
        }
        p.setStockActual(p.getStockActual() - cantidad);
        registrar(null, productoId, TipoMovimiento.salida_venta, BigDecimal.valueOf(cantidad), documento);
    }

    public void devolucionVenta(Long productoId, int cantidad, String documento) {
        Producto p = productos.bloquear(productoId).orElseThrow(() -> new NoEncontrado("Producto no encontrado."));
        p.setStockActual(p.getStockActual() + cantidad);
        registrar(null, productoId, TipoMovimiento.devolucion_venta, BigDecimal.valueOf(cantidad), documento);
    }

    void registrar(Long materialId, Long productoId, TipoMovimiento tipo, BigDecimal cantidad, String documento) {
        MovimientoInventario m = new MovimientoInventario();
        m.setMaterialId(materialId);
        m.setProductoId(productoId);
        m.setUsuarioId(usuario.id());
        m.setTipo(tipo);
        m.setCantidad(cantidad);
        m.setDocumentoRef(documento);
        m.setFecha(LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS));
        movimientos.save(m);
    }
}

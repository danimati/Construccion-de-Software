-- Datos de ejemplo (solo perfil demo). Personas, empresas, precios y NIT son ficticios.
-- Las contraseñas las fija DatosDemo después de ejecutar este script.

TRUNCATE factura, unidad_producida, detalle_pedido, pedido, detalle_cotizacion, cotizacion, cliente,
         cuenta_por_pagar, detalle_orden_compra, orden_compra, proveedor,
         movimiento_inventario, consumo_material, orden_produccion, lista_materiales, producto, material,
         usuario_rol, usuario, detalle_nomina, nomina, horario, empleado, cargo
         RESTART IDENTITY CASCADE;

DELETE FROM rol_permiso;
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r, p.id_permiso
FROM (VALUES
    (1, 'ventas:ver'), (1, 'inventario:ver'), (1, 'produccion:ver'), (1, 'compras:ver'), (1, 'rh:ver'), (1, 'accesos:ver'),
    (2, 'ventas:ver'), (2, 'ventas:editar'), (2, 'inventario:ver'),
    (3, 'inventario:ver'), (3, 'inventario:editar'), (3, 'produccion:ver'), (3, 'produccion:editar'), (3, 'compras:ver'),
    (4, 'inventario:ver'), (4, 'compras:ver'), (4, 'compras:editar'),
    (5, 'rh:ver'), (5, 'rh:editar'),
    (6, 'ventas:ver'), (6, 'inventario:ver'), (6, 'produccion:ver'), (6, 'compras:ver'), (6, 'rh:ver'), (6, 'accesos:ver'), (6, 'accesos:editar')
) AS v(r, codigo)
JOIN permiso p ON p.codigo = v.codigo;

INSERT INTO cargo (id_cargo, id_area, nombre, salario_base) VALUES
    (1, 1, 'Gerente general', 9500000),
    (2, 2, 'Analista de compras', 3400000),
    (3, 3, 'Jefe de producción', 5200000),
    (4, 3, 'Operario de ensamblaje', 1900000),
    (5, 4, 'Ejecutiva comercial', 3600000),
    (6, 5, 'Ingeniero de firmware', 6200000),
    (7, 6, 'Administradora de sistemas', 5800000),
    (8, 2, 'Analista de RR. HH.', 3400000);

INSERT INTO empleado (id_empleado, id_cargo, documento, nombres, apellidos, email, telefono, fecha_ingreso, estado) VALUES
    (1, 1, '10000001', 'Marta', 'Quintero', 'mquintero@novakey.example', '6010000001', '2026-01-15', 'activo'),
    (2, 2, '10000002', 'Jorge', 'Salcedo', 'jsalcedo@novakey.example', '6010000002', '2026-02-02', 'activo'),
    (3, 3, '10000003', 'Paula', 'Rincón', 'princon@novakey.example', '6010000003', '2026-02-02', 'activo'),
    (4, 4, '10000004', 'Wilson', 'Duarte', 'wduarte@novakey.example', '6010000004', '2026-03-02', 'activo'),
    (5, 5, '10000005', 'Elena', 'Campos', 'ecampos@novakey.example', '6010000005', '2026-03-16', 'activo'),
    (6, 6, '10000006', 'Tomás', 'Arias', 'tarias@novakey.example', '6010000006', '2026-02-16', 'vacaciones'),
    (7, 7, '10000007', 'Sara', 'Linares', 'slinares@novakey.example', '6010000007', '2026-02-02', 'activo'),
    (8, 8, '10000008', 'Nora', 'Medina', 'nmedina@novakey.example', '6010000008', '2026-03-02', 'activo');

INSERT INTO horario (id_empleado, dia_semana, hora_inicio, hora_fin)
SELECT e.id_empleado, d, e.ini::time, e.fin::time
FROM (VALUES (1,'08:00','17:00'), (2,'08:00','17:00'), (3,'07:00','16:00'), (4,'07:00','16:00'),
             (5,'08:00','17:00'), (6,'09:00','18:00'), (7,'08:00','17:00'), (8,'08:00','17:00')) AS e(id_empleado, ini, fin)
CROSS JOIN generate_series(1, 5) AS d;

INSERT INTO nomina (id_nomina, periodo_inicio, periodo_fin, fecha_pago, estado)
VALUES (1, '2026-10-01', '2026-10-31', '2026-10-30', 'pagada');
INSERT INTO detalle_nomina (id_nomina, id_empleado, salario_base, devengados, deducciones, neto_pagar)
SELECT 1, e.id_empleado, c.salario_base,
       CASE WHEN e.id_empleado = 4 THEN 180000 ELSE 0 END,
       round(c.salario_base * 0.08, 2),
       c.salario_base + CASE WHEN e.id_empleado = 4 THEN 180000 ELSE 0 END - round(c.salario_base * 0.08, 2)
FROM empleado e JOIN cargo c ON c.id_cargo = e.id_cargo;

INSERT INTO usuario (id_usuario, id_empleado, username, email, password_hash) VALUES
    (1, 1, 'mquintero', 'mquintero@novakey.example', 'pendiente'),
    (2, 5, 'ecampos', 'ecampos@novakey.example', 'pendiente'),
    (3, 3, 'princon', 'princon@novakey.example', 'pendiente'),
    (4, 2, 'jsalcedo', 'jsalcedo@novakey.example', 'pendiente'),
    (5, 8, 'nmedina', 'nmedina@novakey.example', 'pendiente'),
    (6, 7, 'slinares', 'slinares@novakey.example', 'pendiente');
INSERT INTO usuario_rol (id_usuario, id_rol) VALUES (1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 6);

INSERT INTO proveedor (id_proveedor, nit, razon_social, contacto, email, telefono) VALUES
    (1, '900000001-1', 'ElectroPartes S.A.S.', 'Rocío Beltrán', 'ventas@electropartes.example', '6010000101'),
    (2, '900000002-2', 'Visual Tech Andina', 'Hernán Prieto', 'contacto@visualtech.example', '6010000102'),
    (3, '900000003-3', 'Moldes y Carcasas Ltda.', 'Gloria Nieto', 'pedidos@moldes.example', '6010000103'),
    (4, '900000004-4', 'Empaques del Centro', 'Iván Rubio', 'ventas@empaques.example', '6010000104');

INSERT INTO material (id_material, codigo, nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario) VALUES
    (1, 'MAT-001', 'PCB principal', 'und', 420, 150, 38000),
    (2, 'MAT-002', 'Kit de componentes electrónicos', 'kit', 380, 150, 24000),
    (3, 'MAT-003', 'Interruptor mecánico', 'und', 6200, 3000, 1100),
    (4, 'MAT-004', 'Juego de teclas', 'jgo', 310, 120, 42000),
    (5, 'MAT-005', 'Carcasa modular', 'und', 96, 120, 58000),
    (6, 'MAT-006', 'Pantalla OLED', 'und', 64, 100, 46000),
    (7, 'MAT-007', 'Cable USB-C', 'und', 500, 150, 9500),
    (8, 'MAT-008', 'Kit de fijaciones', 'kit', 640, 150, 3200),
    (9, 'MAT-009', 'Caja de empaque', 'und', 140, 150, 6800);

INSERT INTO producto (id_producto, sku, nombre, precio_venta, stock_actual) VALUES
    (1, 'NK-TEC-75', 'Teclado NovaKey 75 % OLED', 690000, 48),
    (2, 'NK-TEC-60', 'Teclado NovaKey 60 % OLED', 590000, 12),
    (3, 'NK-MOD-OLED', 'Módulo OLED adicional', 180000, 30);

INSERT INTO lista_materiales (id_producto, id_material, cantidad) VALUES
    (1, 1, 1), (1, 2, 1), (1, 3, 84), (1, 4, 1), (1, 5, 1), (1, 6, 1), (1, 7, 1), (1, 8, 1), (1, 9, 1),
    (2, 1, 1), (2, 2, 1), (2, 3, 61), (2, 4, 1), (2, 5, 1), (2, 6, 1), (2, 7, 1), (2, 8, 1), (2, 9, 1),
    (3, 6, 1), (3, 8, 1), (3, 9, 1);

INSERT INTO orden_compra (id_orden_compra, id_proveedor, id_usuario, fecha, estado, total) VALUES
    (1, 1, 4, '2026-10-05', 'recibida', 8360000),
    (2, 2, 4, '2026-10-20', 'recibida', 13800000),
    (3, 3, 4, '2026-11-02', 'enviada', 8700000);
INSERT INTO detalle_orden_compra (id_orden_compra, id_material, cantidad, cantidad_recibida, precio_unitario) VALUES
    (1, 1, 220, 220, 38000),
    (2, 6, 300, 300, 46000),
    (3, 5, 150, 0, 58000);
INSERT INTO cuenta_por_pagar (id_orden_compra, monto, saldo, fecha_vencimiento, estado) VALUES
    (1, 8360000, 8360000, '2026-11-20', 'abierta'),
    (2, 13800000, 13800000, '2026-12-05', 'abierta');

INSERT INTO orden_produccion (id_orden_produccion, id_producto, id_usuario, cantidad, fecha_inicio, fecha_fin, estado, avance) VALUES
    (1, 1, 3, 60, '2026-10-01', '2026-10-11', 'terminada', '{60,60,60,60,60,60}'),
    (2, 2, 3, 20, '2026-10-12', '2026-10-20', 'terminada', '{20,20,20,20,20,20}'),
    (3, 1, 3, 40, '2026-10-28', NULL, 'en_proceso', '{40,22,13,7,3,1}');
INSERT INTO consumo_material (id_orden_produccion, id_material, cantidad, fecha)
SELECT 3, l.id_material, l.cantidad * 40, '2026-10-28 08:10:00'
FROM lista_materiales l WHERE l.id_producto = 1;
INSERT INTO unidad_producida (id_orden_produccion, numero_serie, resultado_calidad, fecha_ensamblaje) VALUES
    (3, 'NK75-2026-000059', 'rechazada', '2026-10-31 10:20:00'),
    (3, 'NK75-2026-000060', 'aprobada', '2026-10-31 15:05:00'),
    (3, 'NK75-2026-000061', 'aprobada', '2026-11-03 09:40:00');
SELECT setval('numero_serie_seq', 61);

INSERT INTO movimiento_inventario (id_material, id_producto, id_usuario, tipo, cantidad, documento_ref, fecha) VALUES
    (6, NULL, 4, 'entrada_compra', 300, 'OC-0002', '2026-10-27 11:00:00'),
    (6, NULL, 3, 'salida_produccion', 40, 'OP-0003', '2026-10-28 08:10:00'),
    (5, NULL, 3, 'salida_produccion', 40, 'OP-0003', '2026-10-28 08:10:00'),
    (NULL, 1, 2, 'salida_venta', 10, 'PED-0003', '2026-11-03 14:30:00');

INSERT INTO cliente (id_cliente, tipo, documento, nombre, email, telefono, direccion) VALUES
    (1, 'corp', '901000001-1', 'Andina Software S.A.S.', 'compras@andinasoftware.example', '6010000201', 'Bogotá'),
    (2, 'corp', '901000002-2', 'TecnoRed Distribuciones', 'compras@tecnored.example', '6010000202', 'Bogotá'),
    (3, 'final', '20000003', 'Lucía Fernández', 'lucia@correo.example', '3000000203', 'Bogotá'),
    (4, 'corp', '901000004-4', 'Estudio Kinetic', 'hola@kinetic.example', '6010000204', 'Bogotá');

INSERT INTO cotizacion (id_cotizacion, id_cliente, id_usuario, fecha, vigencia, estado, total) VALUES
    (1, 1, 2, '2026-10-29', '2026-11-15', 'aceptada', 6900000),
    (2, 4, 2, '2026-11-03', '2026-11-30', 'enviada', 3450000);
INSERT INTO detalle_cotizacion (id_cotizacion, id_producto, cantidad, precio_unitario) VALUES
    (1, 1, 10, 690000),
    (2, 1, 5, 690000);

INSERT INTO pedido (id_pedido, id_cliente, id_cotizacion, canal, fecha, estado) VALUES
    (1, 3, NULL, 'directo', '2026-10-22 10:00:00', 'facturado'),
    (2, 2, NULL, 'directo', '2026-11-01 09:15:00', 'confirmado'),
    (3, 1, 1, 'directo', '2026-11-03 14:30:00', 'en_preparacion');
INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES
    (1, 1, 1, 690000),
    (2, 2, 2, 590000),
    (3, 1, 10, 690000);

INSERT INTO factura (id_pedido, numero, fecha, subtotal, impuestos, total, estado) VALUES
    (1, 'FAC-0001', '2026-10-22', 690000, 131100, 821100, 'pagada');
SELECT setval('numero_factura_seq', 1);

-- Los inserts anteriores fijan id explícitos: las identidades deben continuar después de ellos.
SELECT setval(pg_get_serial_sequence('cargo', 'id_cargo'), (SELECT max(id_cargo) FROM cargo));
SELECT setval(pg_get_serial_sequence('empleado', 'id_empleado'), (SELECT max(id_empleado) FROM empleado));
SELECT setval(pg_get_serial_sequence('nomina', 'id_nomina'), (SELECT max(id_nomina) FROM nomina));
SELECT setval(pg_get_serial_sequence('usuario', 'id_usuario'), (SELECT max(id_usuario) FROM usuario));
SELECT setval(pg_get_serial_sequence('proveedor', 'id_proveedor'), (SELECT max(id_proveedor) FROM proveedor));
SELECT setval(pg_get_serial_sequence('material', 'id_material'), (SELECT max(id_material) FROM material));
SELECT setval(pg_get_serial_sequence('producto', 'id_producto'), (SELECT max(id_producto) FROM producto));
SELECT setval(pg_get_serial_sequence('orden_compra', 'id_orden_compra'), (SELECT max(id_orden_compra) FROM orden_compra));
SELECT setval(pg_get_serial_sequence('orden_produccion', 'id_orden_produccion'), (SELECT max(id_orden_produccion) FROM orden_produccion));
SELECT setval(pg_get_serial_sequence('cliente', 'id_cliente'), (SELECT max(id_cliente) FROM cliente));
SELECT setval(pg_get_serial_sequence('cotizacion', 'id_cotizacion'), (SELECT max(id_cotizacion) FROM cotizacion));
SELECT setval(pg_get_serial_sequence('pedido', 'id_pedido'), (SELECT max(id_pedido) FROM pedido));

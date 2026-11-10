-- Datos de referencia necesarios en cualquier instalación: áreas del organigrama, permisos y roles.

INSERT INTO area (id_area, nombre) VALUES
    (1, 'Gerencia General'),
    (2, 'Administración y Finanzas'),
    (3, 'Producción y Operaciones'),
    (4, 'Comercial'),
    (5, 'Investigación y Desarrollo'),
    (6, 'Tecnologías de Información');
SELECT setval(pg_get_serial_sequence('area', 'id_area'), 6);

INSERT INTO permiso (codigo, modulo, descripcion)
SELECT m || ':' || n, m, initcap(n) || ' el módulo ' || m
FROM unnest(ARRAY['ventas','inventario','produccion','compras','rh','accesos']) AS m
CROSS JOIN unnest(ARRAY['ver','editar']) AS n;

INSERT INTO rol (id_rol, nombre, descripcion) VALUES
    (1, 'Gerencia', 'Consulta toda la operación'),
    (2, 'Comercial', 'Clientes, cotizaciones y facturación'),
    (3, 'Producción', 'Inventario y órdenes de ensamblaje'),
    (4, 'Compras', 'Proveedores y cuentas por pagar'),
    (5, 'Recursos Humanos', 'Expedientes, horarios y nómina'),
    (6, 'Administrador TI', 'Administra usuarios y permisos');
SELECT setval(pg_get_serial_sequence('rol', 'id_rol'), 6);

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

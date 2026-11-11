"""IAM (RF01): permisos, roles, usuarios y catálogos de referencia.

Revision ID: 0001_iam
Revises:
Create Date: 2026-11-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_iam"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "permiso",
        sa.Column("id_permiso", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("codigo", sa.String(40), nullable=False, unique=True),
        sa.Column("modulo", sa.String(20), nullable=False),
        sa.Column("descripcion", sa.String(120)),
    )
    op.create_table(
        "rol",
        sa.Column("id_rol", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("nombre", sa.String(80), nullable=False, unique=True),
        sa.Column("descripcion", sa.String(160)),
    )
    op.create_table(
        "usuario",
        sa.Column("id_usuario", sa.BigInteger, primary_key=True, autoincrement=True),
        # Sin FK a empleado todavía: esa tabla pertenece a RH (RF05), que la añadirá.
        sa.Column("id_empleado", sa.BigInteger),
        sa.Column("username", sa.String(50), nullable=False, unique=True),
        sa.Column("email", sa.String(120), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("creado_en", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "rol_permiso",
        sa.Column("id_rol", sa.BigInteger, sa.ForeignKey("rol.id_rol"), primary_key=True),
        sa.Column(
            "id_permiso", sa.BigInteger, sa.ForeignKey("permiso.id_permiso"), primary_key=True
        ),
    )
    op.create_table(
        "usuario_rol",
        sa.Column(
            "id_usuario", sa.BigInteger, sa.ForeignKey("usuario.id_usuario"), primary_key=True
        ),
        sa.Column("id_rol", sa.BigInteger, sa.ForeignKey("rol.id_rol"), primary_key=True),
    )

    _sembrar_catalogos()


def _sembrar_catalogos() -> None:
    """Datos de referencia necesarios en cualquier instalación: permisos y roles."""
    # Permisos: ver/editar por cada módulo.
    op.execute(
        """
        INSERT INTO permiso (codigo, modulo, descripcion)
        SELECT m || ':' || n, m, initcap(n) || ' el módulo ' || m
        FROM unnest(ARRAY['ventas','inventario','produccion','compras','rh','accesos']) AS m
        CROSS JOIN unnest(ARRAY['ver','editar']) AS n;
        """
    )
    op.execute(
        """
        INSERT INTO rol (id_rol, nombre, descripcion) VALUES
            (1, 'Gerencia', 'Consulta toda la operación'),
            (2, 'Comercial', 'Clientes, cotizaciones y facturación'),
            (3, 'Producción', 'Inventario y órdenes de ensamblaje'),
            (4, 'Compras', 'Proveedores y cuentas por pagar'),
            (5, 'Recursos Humanos', 'Expedientes, horarios y nómina'),
            (6, 'Administrador TI', 'Administra usuarios y permisos');
        """
    )
    op.execute("SELECT setval(pg_get_serial_sequence('rol', 'id_rol'), 6);")
    op.execute(
        """
        INSERT INTO rol_permiso (id_rol, id_permiso)
        SELECT r, p.id_permiso
        FROM (VALUES
            (1,'ventas:ver'),(1,'inventario:ver'),(1,'produccion:ver'),(1,'compras:ver'),(1,'rh:ver'),(1,'accesos:ver'),
            (2,'ventas:ver'),(2,'ventas:editar'),(2,'inventario:ver'),
            (3,'inventario:ver'),(3,'inventario:editar'),(3,'produccion:ver'),(3,'produccion:editar'),(3,'compras:ver'),
            (4,'inventario:ver'),(4,'compras:ver'),(4,'compras:editar'),
            (5,'rh:ver'),(5,'rh:editar'),
            (6,'ventas:ver'),(6,'inventario:ver'),(6,'produccion:ver'),(6,'compras:ver'),(6,'rh:ver'),(6,'accesos:ver'),(6,'accesos:editar')
        ) AS v(r, codigo)
        JOIN permiso p ON p.codigo = v.codigo;
        """
    )


def downgrade() -> None:
    op.drop_table("usuario_rol")
    op.drop_table("rol_permiso")
    op.drop_table("usuario")
    op.drop_table("rol")
    op.drop_table("permiso")

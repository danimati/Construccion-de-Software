"""Inventario y Producción (RF02): materiales, productos, listas, órdenes y movimientos.

Revision ID: 0002_inventario
Revises: 0001_iam
Create Date: 2026-11-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_inventario"
down_revision: str | None = "0001_iam"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "material",
        sa.Column("id_material", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("codigo", sa.String(30), nullable=False, unique=True),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("unidad_medida", sa.String(10), nullable=False),
        sa.Column("stock_actual", sa.Numeric(12, 3), nullable=False),
        sa.Column("stock_minimo", sa.Numeric(12, 3), nullable=False),
        sa.Column("costo_unitario", sa.Numeric(12, 2), nullable=False),
        sa.CheckConstraint("stock_actual >= 0", name="material_stock_actual_chk"),
        sa.CheckConstraint("stock_minimo >= 0", name="material_stock_minimo_chk"),
        sa.CheckConstraint("costo_unitario >= 0", name="material_costo_chk"),
    )
    op.create_table(
        "producto",
        sa.Column("id_producto", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("sku", sa.String(30), nullable=False, unique=True),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("precio_venta", sa.Numeric(12, 2), nullable=False),
        sa.Column("stock_actual", sa.Integer, nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.CheckConstraint("precio_venta >= 0", name="producto_precio_chk"),
        sa.CheckConstraint("stock_actual >= 0", name="producto_stock_chk"),
    )
    op.create_table(
        "lista_materiales",
        sa.Column(
            "id_producto", sa.BigInteger, sa.ForeignKey("producto.id_producto"), primary_key=True
        ),
        sa.Column(
            "id_material", sa.BigInteger, sa.ForeignKey("material.id_material"), primary_key=True
        ),
        sa.Column("cantidad", sa.Numeric(12, 3), nullable=False),
        sa.CheckConstraint("cantidad > 0", name="lista_cantidad_chk"),
    )
    op.create_table(
        "orden_produccion",
        sa.Column("id_orden_produccion", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "id_producto", sa.BigInteger, sa.ForeignKey("producto.id_producto"), nullable=False
        ),
        sa.Column(
            "id_usuario", sa.BigInteger, sa.ForeignKey("usuario.id_usuario"), nullable=False
        ),
        sa.Column("cantidad", sa.Integer, nullable=False),
        sa.Column("fecha_inicio", sa.Date),
        sa.Column("fecha_fin", sa.Date),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column(
            "avance",
            sa.ARRAY(sa.Integer),
            nullable=False,
            server_default="{0,0,0,0,0,0}",
        ),
        sa.CheckConstraint("cantidad > 0", name="op_cantidad_chk"),
        sa.CheckConstraint(
            "estado IN ('planeada','en_proceso','terminada','cancelada')", name="op_estado_chk"
        ),
        sa.CheckConstraint("cardinality(avance) = 6", name="op_avance_chk"),
    )
    op.create_table(
        "consumo_material",
        sa.Column("id_consumo", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "id_orden_produccion",
            sa.BigInteger,
            sa.ForeignKey("orden_produccion.id_orden_produccion"),
            nullable=False,
        ),
        sa.Column(
            "id_material", sa.BigInteger, sa.ForeignKey("material.id_material"), nullable=False
        ),
        sa.Column("cantidad", sa.Numeric(12, 3), nullable=False),
        sa.Column("fecha", sa.DateTime, nullable=False),
        sa.CheckConstraint("cantidad > 0", name="consumo_cantidad_chk"),
    )
    op.create_table(
        "unidad_producida",
        sa.Column("id_unidad", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "id_orden_produccion",
            sa.BigInteger,
            sa.ForeignKey("orden_produccion.id_orden_produccion"),
            nullable=False,
        ),
        # FK a detalle_pedido la añadirá Ventas (RF04); aquí es una columna simple.
        sa.Column("id_detalle_pedido", sa.BigInteger),
        sa.Column("numero_serie", sa.String(40), nullable=False, unique=True),
        sa.Column("resultado_calidad", sa.String(20), nullable=False),
        sa.Column("fecha_ensamblaje", sa.DateTime, nullable=False),
        sa.CheckConstraint(
            "resultado_calidad IN ('aprobada','rechazada')", name="unidad_calidad_chk"
        ),
    )
    op.create_table(
        "movimiento_inventario",
        sa.Column("id_movimiento", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("id_material", sa.BigInteger, sa.ForeignKey("material.id_material")),
        sa.Column("id_producto", sa.BigInteger, sa.ForeignKey("producto.id_producto")),
        sa.Column(
            "id_usuario", sa.BigInteger, sa.ForeignKey("usuario.id_usuario"), nullable=False
        ),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("cantidad", sa.Numeric(12, 3), nullable=False),
        sa.Column("documento_ref", sa.String(40), nullable=False),
        sa.Column("fecha", sa.DateTime, nullable=False),
        sa.CheckConstraint(
            "tipo IN ('entrada_compra','salida_produccion','entrada_produccion',"
            "'salida_venta','devolucion_venta','ajuste')",
            name="mov_tipo_chk",
        ),
        sa.CheckConstraint(
            "(id_material IS NULL) <> (id_producto IS NULL)", name="mov_sujeto_chk"
        ),
    )
    op.create_index(
        "movimiento_fecha_idx", "movimiento_inventario", [sa.text("id_movimiento DESC")]
    )

    op.execute("CREATE SEQUENCE IF NOT EXISTS numero_serie_seq;")
    op.execute("CREATE SEQUENCE IF NOT EXISTS numero_factura_seq;")


def downgrade() -> None:
    op.execute("DROP SEQUENCE IF EXISTS numero_factura_seq;")
    op.execute("DROP SEQUENCE IF EXISTS numero_serie_seq;")
    op.drop_index("movimiento_fecha_idx", table_name="movimiento_inventario")
    op.drop_table("movimiento_inventario")
    op.drop_table("unidad_producida")
    op.drop_table("consumo_material")
    op.drop_table("orden_produccion")
    op.drop_table("lista_materiales")
    op.drop_table("producto")
    op.drop_table("material")

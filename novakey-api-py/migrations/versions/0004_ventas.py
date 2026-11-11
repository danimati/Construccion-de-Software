"""Ventas (RF04): clientes, cotizaciones, pedidos y facturas.

Revision ID: 0004_ventas
Revises: 0003_compras
Create Date: 2026-11-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_ventas"
down_revision: str | None = "0003_compras"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cliente",
        sa.Column("id_cliente", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("tipo", sa.String(10), nullable=False),
        sa.Column("documento", sa.String(20), nullable=False, unique=True),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("email", sa.String(120)),
        sa.Column("telefono", sa.String(20)),
        sa.Column("direccion", sa.String(150)),
        sa.CheckConstraint("tipo IN ('corp','final')", name="cliente_tipo_chk"),
    )
    op.create_table(
        "cotizacion",
        sa.Column("id_cotizacion", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("id_cliente", sa.BigInteger, sa.ForeignKey("cliente.id_cliente"), nullable=False),
        sa.Column("id_usuario", sa.BigInteger, sa.ForeignKey("usuario.id_usuario"), nullable=False),
        sa.Column("fecha", sa.Date, nullable=False),
        sa.Column("vigencia", sa.Date, nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("total", sa.Numeric(14, 2), nullable=False),
        sa.CheckConstraint("total >= 0", name="cot_total_chk"),
        sa.CheckConstraint(
            "estado IN ('enviada','aceptada','rechazada')", name="cot_estado_chk"
        ),
    )
    op.create_table(
        "detalle_cotizacion",
        sa.Column("id_detalle_cot", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "id_cotizacion",
            sa.BigInteger,
            sa.ForeignKey("cotizacion.id_cotizacion"),
            nullable=False,
        ),
        sa.Column(
            "id_producto", sa.BigInteger, sa.ForeignKey("producto.id_producto"), nullable=False
        ),
        sa.Column("cantidad", sa.Integer, nullable=False),
        sa.Column("precio_unitario", sa.Numeric(12, 2), nullable=False),
        sa.CheckConstraint("cantidad > 0", name="dcot_cantidad_chk"),
        sa.CheckConstraint("precio_unitario >= 0", name="dcot_precio_chk"),
    )
    op.create_table(
        "pedido",
        sa.Column("id_pedido", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("id_cliente", sa.BigInteger, sa.ForeignKey("cliente.id_cliente"), nullable=False),
        sa.Column("id_cotizacion", sa.BigInteger, sa.ForeignKey("cotizacion.id_cotizacion")),
        sa.Column("canal", sa.String(10), nullable=False),
        sa.Column("fecha", sa.DateTime, nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.CheckConstraint("canal IN ('directo','web')", name="pedido_canal_chk"),
        sa.CheckConstraint(
            "estado IN ('confirmado','en_preparacion','facturado','cancelado')",
            name="pedido_estado_chk",
        ),
    )
    op.create_table(
        "detalle_pedido",
        sa.Column("id_detalle_pedido", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("id_pedido", sa.BigInteger, sa.ForeignKey("pedido.id_pedido"), nullable=False),
        sa.Column(
            "id_producto", sa.BigInteger, sa.ForeignKey("producto.id_producto"), nullable=False
        ),
        sa.Column("cantidad", sa.Integer, nullable=False),
        sa.Column("precio_unitario", sa.Numeric(12, 2), nullable=False),
        sa.CheckConstraint("cantidad > 0", name="dped_cantidad_chk"),
        sa.CheckConstraint("precio_unitario >= 0", name="dped_precio_chk"),
    )
    op.create_table(
        "factura",
        sa.Column("id_factura", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "id_pedido",
            sa.BigInteger,
            sa.ForeignKey("pedido.id_pedido"),
            nullable=False,
            unique=True,
        ),
        sa.Column("numero", sa.String(20), nullable=False, unique=True),
        sa.Column("fecha", sa.Date, nullable=False),
        sa.Column("subtotal", sa.Numeric(14, 2), nullable=False),
        sa.Column("impuestos", sa.Numeric(14, 2), nullable=False),
        sa.Column("total", sa.Numeric(14, 2), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.CheckConstraint("estado IN ('emitida','pagada')", name="factura_estado_chk"),
    )

    # unidad_producida.id_detalle_pedido ya existía (0002) sin FK; ahora que existe detalle_pedido
    # se añade la clave foránea para la trazabilidad del ensamblaje al pedido.
    op.create_foreign_key(
        "unidad_detalle_pedido_fk",
        "unidad_producida",
        "detalle_pedido",
        ["id_detalle_pedido"],
        ["id_detalle_pedido"],
    )


def downgrade() -> None:
    op.drop_constraint("unidad_detalle_pedido_fk", "unidad_producida", type_="foreignkey")
    op.drop_table("factura")
    op.drop_table("detalle_pedido")
    op.drop_table("pedido")
    op.drop_table("detalle_cotizacion")
    op.drop_table("cotizacion")
    op.drop_table("cliente")

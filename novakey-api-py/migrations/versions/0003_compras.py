"""Compras (RF03): proveedores, órdenes de compra, detalles y cuentas por pagar.

Revision ID: 0003_compras
Revises: 0002_inventario
Create Date: 2026-11-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_compras"
down_revision: str | None = "0002_inventario"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "proveedor",
        sa.Column("id_proveedor", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("nit", sa.String(20), nullable=False, unique=True),
        sa.Column("razon_social", sa.String(120), nullable=False),
        sa.Column("contacto", sa.String(80)),
        sa.Column("email", sa.String(120)),
        sa.Column("telefono", sa.String(20)),
    )
    op.create_table(
        "orden_compra",
        sa.Column("id_orden_compra", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "id_proveedor", sa.BigInteger, sa.ForeignKey("proveedor.id_proveedor"), nullable=False
        ),
        sa.Column(
            "id_usuario", sa.BigInteger, sa.ForeignKey("usuario.id_usuario"), nullable=False
        ),
        sa.Column("fecha", sa.Date, nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("total", sa.Numeric(14, 2), nullable=False),
        sa.CheckConstraint("total >= 0", name="oc_total_chk"),
        sa.CheckConstraint(
            "estado IN ('enviada','parcial','recibida','cancelada')", name="oc_estado_chk"
        ),
    )
    op.create_table(
        "detalle_orden_compra",
        sa.Column("id_detalle_oc", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "id_orden_compra",
            sa.BigInteger,
            sa.ForeignKey("orden_compra.id_orden_compra"),
            nullable=False,
        ),
        sa.Column(
            "id_material", sa.BigInteger, sa.ForeignKey("material.id_material"), nullable=False
        ),
        sa.Column("cantidad", sa.Numeric(12, 3), nullable=False),
        sa.Column("cantidad_recibida", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("precio_unitario", sa.Numeric(12, 2), nullable=False),
        sa.CheckConstraint("cantidad > 0", name="doc_cantidad_chk"),
        sa.CheckConstraint("precio_unitario >= 0", name="doc_precio_chk"),
        sa.CheckConstraint(
            "cantidad_recibida BETWEEN 0 AND cantidad", name="doc_recibida_chk"
        ),
    )
    op.create_table(
        "cuenta_por_pagar",
        sa.Column("id_cxp", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "id_orden_compra",
            sa.BigInteger,
            sa.ForeignKey("orden_compra.id_orden_compra"),
            nullable=False,
            unique=True,
        ),
        sa.Column("monto", sa.Numeric(14, 2), nullable=False),
        sa.Column("saldo", sa.Numeric(14, 2), nullable=False),
        sa.Column("fecha_vencimiento", sa.Date, nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.CheckConstraint("monto >= 0", name="cxp_monto_chk"),
        sa.CheckConstraint("saldo >= 0", name="cxp_saldo_chk"),
        sa.CheckConstraint("saldo <= monto", name="cxp_saldo_monto_chk"),
        sa.CheckConstraint("estado IN ('abierta','pagada')", name="cxp_estado_chk"),
    )


def downgrade() -> None:
    op.drop_table("cuenta_por_pagar")
    op.drop_table("detalle_orden_compra")
    op.drop_table("orden_compra")
    op.drop_table("proveedor")

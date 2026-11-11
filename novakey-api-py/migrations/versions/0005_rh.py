"""Recursos Humanos (RF05): áreas, cargos, empleados, horarios y nóminas.

Revision ID: 0005_rh
Revises: 0004_ventas
Create Date: 2026-11-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_rh"
down_revision: str | None = "0004_ventas"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "area",
        sa.Column("id_area", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("nombre", sa.String(80), nullable=False, unique=True),
    )
    op.create_table(
        "cargo",
        sa.Column("id_cargo", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("id_area", sa.BigInteger, sa.ForeignKey("area.id_area"), nullable=False),
        sa.Column("nombre", sa.String(80), nullable=False),
        sa.Column("salario_base", sa.Numeric(12, 2), nullable=False),
        sa.CheckConstraint("salario_base >= 0", name="cargo_salario_chk"),
    )
    op.create_table(
        "empleado",
        sa.Column("id_empleado", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("id_cargo", sa.BigInteger, sa.ForeignKey("cargo.id_cargo"), nullable=False),
        sa.Column("documento", sa.String(20), nullable=False, unique=True),
        sa.Column("nombres", sa.String(80), nullable=False),
        sa.Column("apellidos", sa.String(80), nullable=False),
        sa.Column("email", sa.String(120)),
        sa.Column("telefono", sa.String(20)),
        sa.Column("fecha_ingreso", sa.Date, nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.CheckConstraint(
            "estado IN ('activo','vacaciones','retirado')", name="empleado_estado_chk"
        ),
    )
    op.create_table(
        "horario",
        sa.Column("id_horario", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "id_empleado", sa.BigInteger, sa.ForeignKey("empleado.id_empleado"), nullable=False
        ),
        sa.Column("dia_semana", sa.SmallInteger, nullable=False),
        sa.Column("hora_inicio", sa.Time, nullable=False),
        sa.Column("hora_fin", sa.Time, nullable=False),
        sa.CheckConstraint("dia_semana BETWEEN 1 AND 7", name="horario_dia_chk"),
        sa.CheckConstraint("hora_inicio < hora_fin", name="horario_horas_chk"),
    )
    op.create_table(
        "nomina",
        sa.Column("id_nomina", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("periodo_inicio", sa.Date, nullable=False, unique=True),
        sa.Column("periodo_fin", sa.Date, nullable=False),
        sa.Column("fecha_pago", sa.Date, nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.CheckConstraint("periodo_inicio <= periodo_fin", name="nomina_periodo_chk"),
        sa.CheckConstraint("estado IN ('borrador','pagada')", name="nomina_estado_chk"),
    )
    op.create_table(
        "detalle_nomina",
        sa.Column("id_detalle_nomina", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("id_nomina", sa.BigInteger, sa.ForeignKey("nomina.id_nomina"), nullable=False),
        sa.Column(
            "id_empleado", sa.BigInteger, sa.ForeignKey("empleado.id_empleado"), nullable=False
        ),
        sa.Column("salario_base", sa.Numeric(12, 2), nullable=False),
        sa.Column("devengados", sa.Numeric(12, 2), nullable=False),
        sa.Column("deducciones", sa.Numeric(12, 2), nullable=False),
        sa.Column("neto_pagar", sa.Numeric(12, 2), nullable=False),
        sa.CheckConstraint("devengados >= 0", name="dnom_devengados_chk"),
        sa.CheckConstraint("deducciones >= 0", name="dnom_deducciones_chk"),
        sa.UniqueConstraint("id_nomina", "id_empleado", name="dnom_nomina_empleado_uq"),
    )

    # Áreas del organigrama: datos de referencia necesarios en cualquier instalación.
    op.execute(
        """
        INSERT INTO area (id_area, nombre) VALUES
            (1, 'Gerencia General'),
            (2, 'Administración y Finanzas'),
            (3, 'Producción y Operaciones'),
            (4, 'Comercial'),
            (5, 'Investigación y Desarrollo'),
            (6, 'Tecnologías de Información');
        """
    )
    op.execute("SELECT setval(pg_get_serial_sequence('area','id_area'), 6);")

    # Ahora que existe empleado, se añade la FK de usuario.id_empleado (era columna simple en 0001).
    op.create_foreign_key(
        "usuario_empleado_fk", "usuario", "empleado", ["id_empleado"], ["id_empleado"]
    )


def downgrade() -> None:
    op.drop_constraint("usuario_empleado_fk", "usuario", type_="foreignkey")
    op.drop_table("detalle_nomina")
    op.drop_table("nomina")
    op.drop_table("horario")
    op.drop_table("empleado")
    op.drop_table("cargo")
    op.drop_table("area")

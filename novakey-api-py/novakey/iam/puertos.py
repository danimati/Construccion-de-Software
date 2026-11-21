"""Puertos (interfaces internas) que IAM usa de otros módulos del monolito.

Mantienen el acoplamiento bajo: IAM no importa RH directamente. El módulo RH registrará su
implementación cuando se integre (RF05); mientras tanto se usa una por defecto que no resuelve
nombres, de modo que IAM funciona de forma autónoma.
"""

from __future__ import annotations

from typing import Protocol

from sqlalchemy.orm import Session


class ConsultaEmpleados(Protocol):
    """Permite a IAM mostrar el nombre completo del empleado asociado a un usuario."""

    def nombre_completo(self, sesion: Session, empleado_id: int) -> str | None: ...


class SinEmpleados:
    """Implementación por defecto: no hay módulo RH todavía."""

    def nombre_completo(self, sesion: Session, empleado_id: int) -> str | None:
        return None


# Punto de registro. RF05 lo sustituirá por su implementación real.
consulta_empleados: ConsultaEmpleados = SinEmpleados()


def registrar_consulta_empleados(impl: ConsultaEmpleados) -> None:
    global consulta_empleados
    consulta_empleados = impl

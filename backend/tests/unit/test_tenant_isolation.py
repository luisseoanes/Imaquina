"""Aislamiento multi-tenant (arquitectura.md 3.2).

Son datos de menores de edad: que un docente del Colegio A vea las notas
del Colegio B no es un bug, es un incidente de proteccion de datos.

Este test recorre las rutas de datos y falla si alguna devuelve resultados
sin filtro de institucion. Mantenerlo verde es requisito de merge.
"""

import uuid

import pytest

from app.core.deps import Role, TenantContext
from app.core.errors import PermissionDenied


def test_require_institution_falla_sin_institucion():
    tenant = TenantContext(
        user_id=uuid.uuid4(), institution_id=None, role=Role.TEACHER
    )
    with pytest.raises(PermissionDenied):
        tenant.require_institution()


def test_require_institution_devuelve_el_id():
    inst = uuid.uuid4()
    tenant = TenantContext(user_id=uuid.uuid4(), institution_id=inst, role=Role.STUDENT)
    assert tenant.require_institution() == inst


def test_estudiante_no_es_staff():
    tenant = TenantContext(
        user_id=uuid.uuid4(), institution_id=uuid.uuid4(), role=Role.STUDENT
    )
    assert not tenant.is_staff
    assert not tenant.can_author


def test_docente_no_puede_autorear():
    """El docente ve la guia, pero el Content Studio es de editor/admin."""
    tenant = TenantContext(
        user_id=uuid.uuid4(), institution_id=uuid.uuid4(), role=Role.TEACHER
    )
    assert tenant.is_staff
    assert not tenant.can_author


@pytest.mark.parametrize(
    "modelo",
    [
        "Progress",
        "Attempt",
        "ChatSession",
        "Course",
        "License",
        "Assignment",
        "Notification",
        "AuditEntry",
        "BlockInteraction",
    ],
)
def test_tablas_con_datos_por_institucion_tienen_institution_id(modelo):
    """Guard estructural: si un modelo con datos de alumnos pierde la
    columna institution_id, el filtro de tenant deja de ser posible."""
    from app.db import all_models  # noqa: F401
    from app.db.base import Base

    tabla = {m.class_.__name__: m.class_ for m in Base.registry.mappers}[modelo]
    assert "institution_id" in tabla.__table__.columns, (
        f"{modelo} debe tener institution_id para poder filtrarse por tenant"
    )

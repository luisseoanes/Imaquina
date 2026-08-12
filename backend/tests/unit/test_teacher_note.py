"""R4: la guia docente se filtra en el BACKEND, nunca en el frontend.

Ocultarla con CSS o un `if` de React no sirve: cualquier estudiante
abre DevTools y lee el JSON.
"""

import uuid

from app.core.deps import Role, TenantContext
from app.modules.learning.service import serialize_moment_for

MOMENT = {
    "id": str(uuid.uuid4()),
    "type": "intro",
    "title": "Introduccion",
    "teacher_note": "Divida el curso en equipos de 4 antes de empezar.",
    "blocks": [],
}


def _tenant(role: Role) -> TenantContext:
    return TenantContext(
        user_id=uuid.uuid4(), institution_id=uuid.uuid4(), role=role
    )


def test_estudiante_no_recibe_la_guia_docente():
    out = serialize_moment_for(MOMENT, _tenant(Role.STUDENT))
    assert "teacher_note" not in out
    assert "equipos de 4" not in str(out)


def test_docente_si_recibe_la_guia_docente():
    out = serialize_moment_for(MOMENT, _tenant(Role.TEACHER))
    assert out["teacher_note"] == MOMENT["teacher_note"]


def test_editor_y_admin_tambien():
    for role in (Role.EDITOR, Role.ADMIN):
        assert serialize_moment_for(MOMENT, _tenant(role))["teacher_note"]

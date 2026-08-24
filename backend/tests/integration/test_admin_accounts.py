"""Alta de cuentas, cursos y matrículas (N3, N4).

Guard `Admin`, no `Author`: ni editor ni docente pueden dar de alta cuentas.
Todo scopeado a `tenant.institution_id` -- son datos de menores, cruzar
instituciones es un incidente, no un bug.
"""

import uuid
from datetime import date, timedelta

import pytest

from app.core.security import create_token, hash_password
from app.modules.identity.models import Calendar, Institution, License, User

ADMIN_BASE = "/api/v1/admin"
COURSES_BASE = "/api/v1/courses"


async def _institucion(db) -> Institution:
    inst = Institution(name=f"Colegio {uuid.uuid4().hex[:6]}", calendar=Calendar.A)
    db.add(inst)
    await db.flush()
    db.add(
        License(
            institution_id=inst.id,
            calendar=Calendar.A,
            valid_from=date.today() - timedelta(days=1),
            valid_to=date.today() + timedelta(days=365),
            seats=50,
        )
    )
    await db.flush()
    return inst


async def _usuario(db, inst: Institution, role: str) -> User:
    user = User(
        email=f"{role}-{uuid.uuid4().hex[:6]}@imaquina.example.com",
        full_name=role,
        password_hash=hash_password("x"),
        role=role,
        institution_id=inst.id,
    )
    db.add(user)
    await db.flush()
    return user


def _h(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _token(db, inst: Institution, role: str) -> str:
    user = await _usuario(db, inst, role)
    return create_token(
        subject=user.id, institution_id=inst.id, role=role, token_type="access"
    )


# --- Alta de cuentas (N3) ----------------------------------------------------


async def test_admin_crea_una_cuenta(client, db):
    inst = await _institucion(db)
    h = _h(await _token(db, inst, "admin"))

    resp = await client.post(
        f"{ADMIN_BASE}/users",
        headers=h,
        json={
            "email": "nuevo.estudiante@imaquina.example.com",
            "full_name": "Estudiante Nuevo",
            "password": "contrasena123",
            "role": "student",
            "grade": "5",
        },
    )

    assert resp.status_code == 201
    assert resp.json()["role"] == "student"


@pytest.mark.parametrize("role", ["student", "teacher", "editor"])
async def test_solo_admin_da_de_alta_cuentas(client, db, role):
    inst = await _institucion(db)
    h = _h(await _token(db, inst, role))

    resp = await client.post(
        f"{ADMIN_BASE}/users",
        headers=h,
        json={
            "email": "x@imaquina.example.com",
            "full_name": "X",
            "password": "contrasena123",
            "role": "student",
        },
    )

    assert resp.status_code == 403


async def test_correo_repetido_da_409(client, db):
    inst = await _institucion(db)
    h = _h(await _token(db, inst, "admin"))
    payload = {
        "email": "dup@imaquina.example.com",
        "full_name": "Uno",
        "password": "contrasena123",
        "role": "student",
    }

    primero = await client.post(f"{ADMIN_BASE}/users", headers=h, json=payload)
    segundo = await client.post(f"{ADMIN_BASE}/users", headers=h, json=payload)

    assert primero.status_code == 201
    assert segundo.status_code == 409


async def test_desactivar_no_borra_la_cuenta(client, db):
    inst = await _institucion(db)
    h = _h(await _token(db, inst, "admin"))
    estudiante = await _usuario(db, inst, "student")

    resp = await client.patch(
        f"{ADMIN_BASE}/users/{estudiante.id}", headers=h, json={"is_active": False}
    )

    assert resp.status_code == 200
    assert resp.json()["is_active"] is False
    listado = await client.get(f"{ADMIN_BASE}/users", headers=h)
    assert any(u["id"] == str(estudiante.id) for u in listado.json())


async def test_no_se_puede_editar_un_usuario_de_otra_institucion(client, db):
    inst_a = await _institucion(db)
    inst_b = await _institucion(db)
    h = _h(await _token(db, inst_a, "admin"))
    de_otra = await _usuario(db, inst_b, "student")

    resp = await client.patch(
        f"{ADMIN_BASE}/users/{de_otra.id}", headers=h, json={"grade": "6"}
    )

    assert resp.status_code == 404


# --- Cursos y matrículas (N4) -------------------------------------------------


async def test_admin_crea_un_curso_y_matricula(client, db):
    inst = await _institucion(db)
    h = _h(await _token(db, inst, "admin"))
    estudiante = await _usuario(db, inst, "student")

    curso = (
        await client.post(
            COURSES_BASE, headers=h, json={"name": "Robótica 5A", "grade": "5"}
        )
    ).json()
    matricula = await client.post(
        f"{COURSES_BASE}/{curso['id']}/enrollments",
        headers=h,
        json={"user_id": str(estudiante.id)},
    )
    estudiantes = await client.get(f"{COURSES_BASE}/{curso['id']}/students", headers=h)

    assert matricula.status_code == 204
    assert estudiantes.json()[0]["id"] == str(estudiante.id)


async def test_matricular_dos_veces_da_409(client, db):
    inst = await _institucion(db)
    h = _h(await _token(db, inst, "admin"))
    estudiante = await _usuario(db, inst, "student")
    curso = (
        await client.post(
            COURSES_BASE, headers=h, json={"name": "Robótica 5A", "grade": "5"}
        )
    ).json()
    await client.post(
        f"{COURSES_BASE}/{curso['id']}/enrollments",
        headers=h,
        json={"user_id": str(estudiante.id)},
    )

    resp = await client.post(
        f"{COURSES_BASE}/{curso['id']}/enrollments",
        headers=h,
        json={"user_id": str(estudiante.id)},
    )

    assert resp.status_code == 409


async def test_un_docente_solo_ve_sus_propios_cursos_con_mine(client, db):
    inst = await _institucion(db)
    admin_h = _h(await _token(db, inst, "admin"))
    docente = await _usuario(db, inst, "teacher")
    docente_h = _h(
        create_token(
            subject=docente.id,
            institution_id=inst.id,
            role="teacher",
            token_type="access",
        )
    )

    await client.post(
        COURSES_BASE,
        headers=admin_h,
        json={"name": "Del docente", "grade": "5", "teacher_id": str(docente.id)},
    )
    await client.post(
        COURSES_BASE, headers=admin_h, json={"name": "De otro", "grade": "5"}
    )

    todos = await client.get(COURSES_BASE, headers=docente_h)
    solo_mios = await client.get(f"{COURSES_BASE}?mine=true", headers=docente_h)

    assert len(todos.json()) == 2
    assert len(solo_mios.json()) == 1
    assert solo_mios.json()[0]["name"] == "Del docente"


async def test_un_estudiante_no_puede_crear_cursos(client, db):
    inst = await _institucion(db)
    h = _h(await _token(db, inst, "student"))

    resp = await client.post(COURSES_BASE, headers=h, json={"name": "X", "grade": "5"})

    assert resp.status_code == 403

"""Cambio y restablecimiento de contraseña (N15).

Las cuentas las crea un administrador (N3) y hasta ahora nadie podía cambiar la
contraseña que le tocó: ni el dueño ni el administrador. Son cuentas de
menores, así que una credencial que un tercero conoce para siempre no es un
detalle de usabilidad.
"""

import uuid
from datetime import date, timedelta

from app.core.security import create_token, hash_password
from app.modules.identity.models import Calendar, Institution, License, User

AUTH_BASE = "/api/v1/auth"
ADMIN_BASE = "/api/v1/admin"


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


async def _usuario(db, inst: Institution, role: str, password: str) -> User:
    user = User(
        email=f"{role}-{uuid.uuid4().hex[:6]}@imaquina.example.com",
        full_name=role,
        password_hash=hash_password(password),
        role=role,
        institution_id=inst.id,
    )
    db.add(user)
    await db.flush()
    return user


def _h(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _access(user: User) -> str:
    return create_token(
        subject=user.id,
        institution_id=user.institution_id,
        role=user.role,
        token_type="access",
    )


async def _login(client, user: User, password: str):
    return await client.post(
        f"{AUTH_BASE}/login", json={"email": user.email, "password": password}
    )


# --- El usuario cambia la suya ----------------------------------------------


async def test_cambiar_password_deja_entrar_con_la_nueva_y_no_con_la_vieja(client, db):
    inst = await _institucion(db)
    user = await _usuario(db, inst, "student", "vieja-12345")

    resp = await client.post(
        f"{AUTH_BASE}/me/password",
        headers=_h(_access(user)),
        json={"current_password": "vieja-12345", "new_password": "nueva-12345"},
    )
    assert resp.status_code == 200, resp.text

    assert (await _login(client, user, "nueva-12345")).status_code == 200
    assert (await _login(client, user, "vieja-12345")).status_code == 403


async def test_cambiar_password_devuelve_un_par_de_tokens_utilizable(client, db):
    """El refresh que devuelve TIENE que servir: el cambio revoca todos los
    demás, así que si este no valiera, cambiar la contraseña te echaría."""
    inst = await _institucion(db)
    user = await _usuario(db, inst, "student", "vieja-12345")

    resp = await client.post(
        f"{AUTH_BASE}/me/password",
        headers=_h(_access(user)),
        json={"current_password": "vieja-12345", "new_password": "nueva-12345"},
    )
    nuevo = resp.json()["refresh_token"]

    assert (
        await client.post(f"{AUTH_BASE}/refresh", json={"refresh_token": nuevo})
    ).status_code == 200


async def test_cambiar_password_revoca_las_sesiones_anteriores(client, db):
    """Es el punto del ejercicio: si la contraseña se cambia porque alguien más
    la sabía, el refresh que ese alguien tenga tiene que morir."""
    inst = await _institucion(db)
    user = await _usuario(db, inst, "student", "vieja-12345")
    viejo = (await _login(client, user, "vieja-12345")).json()["refresh_token"]

    await client.post(
        f"{AUTH_BASE}/me/password",
        headers=_h(_access(user)),
        json={"current_password": "vieja-12345", "new_password": "nueva-12345"},
    )

    resp = await client.post(f"{AUTH_BASE}/refresh", json={"refresh_token": viejo})
    assert resp.status_code == 401


async def test_cambiar_password_exige_la_actual(client, db):
    inst = await _institucion(db)
    user = await _usuario(db, inst, "student", "vieja-12345")

    resp = await client.post(
        f"{AUTH_BASE}/me/password",
        headers=_h(_access(user)),
        json={"current_password": "me-la-invento", "new_password": "nueva-12345"},
    )
    assert resp.status_code == 422
    assert (await _login(client, user, "vieja-12345")).status_code == 200


async def test_la_nueva_no_puede_ser_la_misma(client, db):
    inst = await _institucion(db)
    user = await _usuario(db, inst, "student", "vieja-12345")

    resp = await client.post(
        f"{AUTH_BASE}/me/password",
        headers=_h(_access(user)),
        json={"current_password": "vieja-12345", "new_password": "vieja-12345"},
    )
    assert resp.status_code == 422


async def test_cambiar_password_exige_estar_autenticado(client, db):
    resp = await client.post(
        f"{AUTH_BASE}/me/password",
        json={"current_password": "vieja-12345", "new_password": "nueva-12345"},
    )
    assert resp.status_code == 401


# --- El administrador restablece la de otro ---------------------------------


async def test_admin_restablece_la_de_un_estudiante(client, db):
    inst = await _institucion(db)
    admin = await _usuario(db, inst, "admin", "admin-12345")
    alumno = await _usuario(db, inst, "student", "olvidada-123")

    resp = await client.post(
        f"{ADMIN_BASE}/users/{alumno.id}/reset-password",
        headers=_h(_access(admin)),
        json={"new_password": "puesta-12345"},
    )
    assert resp.status_code == 204, resp.text
    assert (await _login(client, alumno, "puesta-12345")).status_code == 200
    assert (await _login(client, alumno, "olvidada-123")).status_code == 403


async def test_el_reset_revoca_las_sesiones_del_afectado(client, db):
    inst = await _institucion(db)
    admin = await _usuario(db, inst, "admin", "admin-12345")
    alumno = await _usuario(db, inst, "student", "olvidada-123")
    viejo = (await _login(client, alumno, "olvidada-123")).json()["refresh_token"]

    await client.post(
        f"{ADMIN_BASE}/users/{alumno.id}/reset-password",
        headers=_h(_access(admin)),
        json={"new_password": "puesta-12345"},
    )

    resp = await client.post(f"{AUTH_BASE}/refresh", json={"refresh_token": viejo})
    assert resp.status_code == 401


async def test_admin_no_restablece_la_de_otra_institucion(client, db):
    """404 y no 403: confirmar que la cuenta existe ya sería filtrar."""
    inst_a = await _institucion(db)
    inst_b = await _institucion(db)
    admin = await _usuario(db, inst_a, "admin", "admin-12345")
    ajeno = await _usuario(db, inst_b, "student", "ajena-12345")

    resp = await client.post(
        f"{ADMIN_BASE}/users/{ajeno.id}/reset-password",
        headers=_h(_access(admin)),
        json={"new_password": "puesta-12345"},
    )
    assert resp.status_code == 404
    assert (await _login(client, ajeno, "ajena-12345")).status_code == 200


async def test_un_docente_no_puede_restablecer_contrasenas(client, db):
    inst = await _institucion(db)
    docente = await _usuario(db, inst, "teacher", "docente-1234")
    alumno = await _usuario(db, inst, "student", "olvidada-123")

    resp = await client.post(
        f"{ADMIN_BASE}/users/{alumno.id}/reset-password",
        headers=_h(_access(docente)),
        json={"new_password": "puesta-12345"},
    )
    assert resp.status_code == 403
    assert (await _login(client, alumno, "olvidada-123")).status_code == 200


async def test_la_contrasena_nueva_tiene_minimo(client, db):
    inst = await _institucion(db)
    admin = await _usuario(db, inst, "admin", "admin-12345")
    alumno = await _usuario(db, inst, "student", "olvidada-123")

    resp = await client.post(
        f"{ADMIN_BASE}/users/{alumno.id}/reset-password",
        headers=_h(_access(admin)),
        json={"new_password": "corta"},
    )
    assert resp.status_code == 422

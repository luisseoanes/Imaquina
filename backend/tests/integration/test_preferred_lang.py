"""Idioma preferido persistido en la cuenta (I7, R6).

`User.preferred_lang` existía y el login lo devolvía, pero no había forma de
cambiarlo: el idioma vivía sólo en `localStorage` y se perdía al cambiar de
equipo. En el aula de robótica no hay un PC por estudiante, así que un idioma
pegado al navegador es justo el que no sirve.
"""

import uuid
from datetime import date, timedelta

from app.core.security import create_token, hash_password
from app.modules.identity.models import Calendar, Institution, License, User

AUTH_BASE = "/api/v1/auth"


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


async def _usuario(db, inst: Institution) -> User:
    user = User(
        email=f"alumno-{uuid.uuid4().hex[:6]}@imaquina.example.com",
        full_name="Alumno",
        password_hash=hash_password("clave-12345"),
        role="student",
        institution_id=inst.id,
    )
    db.add(user)
    await db.flush()
    return user


def _h(user: User) -> dict[str, str]:
    token = create_token(
        subject=user.id,
        institution_id=user.institution_id,
        role=user.role,
        token_type="access",
    )
    return {"Authorization": f"Bearer {token}"}


async def test_cambiar_el_idioma_lo_devuelve_ya_cambiado(client, db):
    inst = await _institucion(db)
    user = await _usuario(db, inst)

    resp = await client.patch(f"{AUTH_BASE}/me", headers=_h(user), json={"lang": "en"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["lang"] == "en"

    assert (await client.get(f"{AUTH_BASE}/me", headers=_h(user))).json()["lang"] == "en"


async def test_el_idioma_sobrevive_a_un_login_nuevo(client, db):
    """El punto del ejercicio: cambiar de equipo no debe perderlo."""
    inst = await _institucion(db)
    user = await _usuario(db, inst)
    await client.patch(f"{AUTH_BASE}/me", headers=_h(user), json={"lang": "en"})

    resp = await client.post(
        f"{AUTH_BASE}/login", json={"email": user.email, "password": "clave-12345"}
    )
    assert resp.json()["lang"] == "en"


async def test_un_idioma_fuera_del_MVP_se_rechaza(client, db):
    inst = await _institucion(db)
    user = await _usuario(db, inst)

    resp = await client.patch(f"{AUTH_BASE}/me", headers=_h(user), json={"lang": "fr"})
    assert resp.status_code == 422
    assert (await client.get(f"{AUTH_BASE}/me", headers=_h(user))).json()["lang"] == "es"


async def test_cambiar_el_idioma_exige_estar_autenticado(client, db):
    assert (await client.patch(f"{AUTH_BASE}/me", json={"lang": "en"})).status_code == 401

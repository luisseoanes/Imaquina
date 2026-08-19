"""Ciclo de vida de la sesión (R2).

El access token dura 15 minutos: sin `/auth/refresh` la sesión se muere y no
hay forma de renovarla. Lo que este endpoint NO puede hacer es convertirse en
una puerta trasera a la vigencia — de ahí que la licencia se revalide en cada
emisión y no sólo en el login.
"""

from datetime import UTC, date, datetime, timedelta

import pytest

from app.core.security import create_token, decode_token, hash_password
from app.modules.identity.models import Calendar, Institution, License, User


async def _con_licencia(db, *, hasta: date, role: str = "student") -> User:
    inst = Institution(name=f"Colegio {hasta}", calendar=Calendar.A)
    db.add(inst)
    await db.flush()
    db.add(
        License(
            institution_id=inst.id,
            calendar=Calendar.A,
            valid_from=date.today() - timedelta(days=365),
            valid_to=hasta,
            seats=10,
        )
    )
    user = User(
        email=f"u{hasta}{role}@imaquina.example.com",
        full_name="Usuario",
        password_hash=hash_password("secreta"),
        role=role,
        institution_id=inst.id,
    )
    db.add(user)
    await db.flush()
    return user


def _refresh_token(user: User) -> str:
    return create_token(
        subject=user.id,
        institution_id=user.institution_id,
        role=user.role,
        token_type="refresh",
    )


async def test_refresh_devuelve_un_access_token_usable(client, db):
    user = await _con_licencia(db, hasta=date.today() + timedelta(days=30))

    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": _refresh_token(user)}
    )

    assert resp.status_code == 200
    claims = decode_token(resp.json()["access_token"])
    assert claims["type"] == "access"
    assert claims["sub"] == str(user.id)


async def test_refresh_no_revive_una_licencia_vencida(client, db):
    """El agujero obvio: refrescar para siempre con la licencia caducada."""
    user = await _con_licencia(db, hasta=date.today() - timedelta(days=1))

    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": _refresh_token(user)}
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "license_expired"


async def test_el_access_token_no_sirve_para_refrescar(client, db):
    user = await _con_licencia(db, hasta=date.today() + timedelta(days=30))
    access = create_token(
        subject=user.id,
        institution_id=user.institution_id,
        role=user.role,
        token_type="access",
    )

    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": access})

    assert resp.status_code == 401


async def test_refresh_relee_el_rol_de_la_base_no_del_token(client, db):
    """Si a alguien se le baja el rol, no puede conservarlo 30 dias."""
    user = await _con_licencia(db, hasta=date.today() + timedelta(days=30), role="admin")
    token = _refresh_token(user)

    user.role = "student"
    await db.flush()

    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": token})

    assert decode_token(resp.json()["access_token"])["role"] == "student"


async def test_la_cuenta_desactivada_no_puede_refrescar(client, db):
    user = await _con_licencia(db, hasta=date.today() + timedelta(days=30))
    token = _refresh_token(user)
    user.is_active = False
    await db.flush()

    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": token})

    assert resp.status_code == 401


@pytest.mark.parametrize("basura", ["", "no-es-un-jwt", "a.b.c"])
async def test_un_token_corrupto_da_401(client, basura):
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": basura})
    assert resp.status_code == 401


async def test_la_vigencia_recorta_el_access_token_del_refresh(client, db):
    """R2: el exp nunca supera el fin de licencia, tampoco al refrescar."""
    vence = date.today() + timedelta(days=1)
    user = await _con_licencia(db, hasta=vence)

    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": _refresh_token(user)}
    )

    exp = datetime.fromtimestamp(decode_token(resp.json()["access_token"])["exp"], UTC)
    assert exp.date() <= vence


async def test_sin_token_los_endpoints_dan_401_no_403(client):
    """El cliente distingue 'renueva el acceso' de 'esto no te toca'."""
    resp = await client.get("/api/v1/auth/me")

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthenticated"

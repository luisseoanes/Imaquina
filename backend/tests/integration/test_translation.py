"""Flujo de traducción (fase 7): dashboard de cobertura y glosario."""

import uuid
from datetime import date, timedelta

from app.core.security import create_token, hash_password
from app.modules.identity.models import Calendar, Institution, License, User

STUDIO = "/api/v1/studio"
CATALOG = "/api/v1/studio/catalog"


def _h(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _editor_h(db) -> dict[str, str]:
    inst = Institution(name=f"C{uuid.uuid4().hex[:6]}", calendar=Calendar.A)
    db.add(inst)
    await db.flush()
    db.add(
        License(
            institution_id=inst.id,
            calendar=Calendar.A,
            valid_from=date.today() - timedelta(days=1),
            valid_to=date.today() + timedelta(days=365),
            seats=10,
        )
    )
    u = User(
        email=f"e-{uuid.uuid4().hex[:6]}@imaquina.example.com",
        full_name="ed",
        password_hash=hash_password("x"),
        role="editor",
        institution_id=inst.id,
    )
    db.add(u)
    await db.flush()
    return _h(
        create_token(
            subject=u.id, institution_id=inst.id, role="editor", token_type="access"
        )
    )


async def test_el_dashboard_marca_es_completo_y_en_incompleto(client, db):
    h = await _editor_h(db)
    creado = (
        await client.post(
            f"{CATALOG}/projects",
            headers=h,
            json={"slug": f"p-{uuid.uuid4().hex[:6]}", "grade": "5", "title": "P"},
        )
    ).json()
    for m in creado["moments"]:
        await client.patch(
            f"{CATALOG}/moments/{m['id']}", headers=h, json={"title": "T"}
        )
        await client.post(
            f"{CATALOG}/moments/{m['id']}/blocks",
            headers=h,
            json={"kind": "text", "body": "c"},
        )

    filas = (
        await client.get(f"{STUDIO}/translation/dashboard?kind=project", headers=h)
    ).json()
    fila = next(f for f in filas if f["id"] == creado["id"])
    assert fila["langs"]["es"]["complete"] is True
    assert fila["langs"]["en"]["complete"] is False


async def test_crud_del_glosario(client, db):
    h = await _editor_h(db)

    creado = await client.post(
        f"{STUDIO}/glossary",
        headers=h,
        json={
            "source_lang": "es",
            "target_lang": "en",
            "term_source": "placa controladora",
            "term_target": "controller board",
            "note": "no 'control board'",
        },
    )
    assert creado.status_code == 201
    tid = creado.json()["id"]

    # duplicado -> 409
    dup = await client.post(
        f"{STUDIO}/glossary",
        headers=h,
        json={
            "source_lang": "es",
            "target_lang": "en",
            "term_source": "placa controladora",
            "term_target": "otra cosa",
        },
    )
    assert dup.status_code == 409

    listado = (await client.get(f"{STUDIO}/glossary", headers=h)).json()
    assert listado[0]["term_target"] == "controller board"

    await client.delete(f"{STUDIO}/glossary/{tid}", headers=h)
    assert (await client.get(f"{STUDIO}/glossary", headers=h)).json() == []

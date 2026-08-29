"""Flujo editorial (fase 4): estados, gate de publicación y comentarios."""

import uuid
from datetime import date, timedelta

from app.core.security import create_token, hash_password
from app.modules.identity.models import Calendar, Institution, License, User

CATALOG = "/api/v1/studio/catalog"
PUBLISHING = "/api/v1/studio/publishing"
REVIEW = "/api/v1/studio/review"


def _h(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _inst(db) -> Institution:
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
    await db.flush()
    return inst


async def _editor_h(db, inst) -> dict[str, str]:
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


async def _proyecto_listo(client, h) -> str:
    creado = (
        await client.post(
            f"{CATALOG}/projects",
            headers=h,
            json={"slug": f"p-{uuid.uuid4().hex[:6]}", "grade": "5", "title": "P"},
        )
    ).json()
    for m in creado["moments"]:
        await client.patch(f"{CATALOG}/moments/{m['id']}", headers=h, json={"title": "T"})
        await client.post(
            f"{CATALOG}/moments/{m['id']}/blocks",
            headers=h,
            json={"kind": "text", "body": "c"},
        )
    return creado["id"]


async def test_no_se_publica_un_borrador_sin_aprobar(client, db):
    inst = await _inst(db)
    h = await _editor_h(db, inst)
    pid = await _proyecto_listo(client, h)

    resp = await client.post(f"{PUBLISHING}/projects/{pid}/publish", headers=h)

    assert resp.status_code == 422
    assert "aprobado" in resp.json()["error"]["message"]


async def test_flujo_completo_borrador_revision_aprobado_publicado(client, db):
    inst = await _inst(db)
    h = await _editor_h(db, inst)
    pid = await _proyecto_listo(client, h)

    for estado in ("in_review", "approved"):
        r = await client.post(
            f"{CATALOG}/projects/{pid}/transition", headers=h, json={"to_status": estado}
        )
        assert r.status_code == 200

    publicado = await client.post(f"{PUBLISHING}/projects/{pid}/publish", headers=h)
    assert publicado.status_code == 200

    hist = (await client.get(f"{REVIEW}/project/{pid}", headers=h)).json()
    assert [e["to_status"] for e in hist["events"]] == ["in_review", "approved"]


async def test_editar_un_proyecto_aprobado_lo_devuelve_a_revision(client, db):
    inst = await _inst(db)
    h = await _editor_h(db, inst)
    pid = await _proyecto_listo(client, h)
    for estado in ("in_review", "approved"):
        await client.post(
            f"{CATALOG}/projects/{pid}/transition", headers=h, json={"to_status": estado}
        )

    mid = (await client.get(f"{CATALOG}/projects/{pid}", headers=h)).json()["moments"][0][
        "id"
    ]
    await client.patch(f"{CATALOG}/moments/{mid}", headers=h, json={"title": "Otro"})

    estado = (await client.get(f"{CATALOG}/projects/{pid}", headers=h)).json()["status"]
    assert estado == "in_review"


async def test_una_transicion_ilegal_da_409(client, db):
    inst = await _inst(db)
    h = await _editor_h(db, inst)
    pid = await _proyecto_listo(client, h)

    # draft -> approved directamente no está permitido
    resp = await client.post(
        f"{CATALOG}/projects/{pid}/transition", headers=h, json={"to_status": "approved"}
    )
    assert resp.status_code == 409


async def test_comentarios_de_revision(client, db):
    inst = await _inst(db)
    h = await _editor_h(db, inst)
    pid = await _proyecto_listo(client, h)

    creado = await client.post(
        f"{REVIEW}/comments",
        headers=h,
        json={"target_type": "project", "target_id": pid, "body": "Revisar el momento 3"},
    )
    assert creado.status_code == 201
    cid = creado.json()["id"]

    await client.post(
        f"{REVIEW}/comments/{cid}/resolve", headers=h, json={"resolved": True}
    )
    hist = (await client.get(f"{REVIEW}/project/{pid}", headers=h)).json()
    assert hist["comments"][0]["resolved"] is True

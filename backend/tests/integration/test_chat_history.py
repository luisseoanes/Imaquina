"""Historial de conversación, rate limit y registro de rechazos (C1, C2, C5, N7).

Todo contra `StubProvider` (conftest fuerza `ANTHROPIC_API_KEY` vacía): cero
red, cero costo. `StubProvider.is_in_domain` devuelve `True` por defecto, así
que estos tests ejercitan el camino normal salvo que se sobreescriba la
dependencia `get_assistant_provider`.
"""

import uuid
from datetime import date, timedelta

from app.core.security import create_token, hash_password
from app.main import app
from app.modules.assistant import service
from app.modules.assistant.provider import StubProvider, get_assistant_provider
from app.modules.identity.models import Calendar, Institution, License, User

CHAT = "/api/v1/chat"


def _h(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _usuario_con_licencia(db, *, role: str = "student") -> tuple[User, Institution]:
    inst = Institution(name=f"Colegio {uuid.uuid4().hex[:6]}", calendar=Calendar.A)
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
    user = User(
        email=f"u-{uuid.uuid4().hex[:6]}@imaquina.example.com",
        full_name="Usuario",
        password_hash=hash_password("x"),
        role=role,
        institution_id=inst.id,
        grade="5",
    )
    db.add(user)
    await db.flush()
    return user, inst


def _token_de(user: User, inst: Institution) -> str:
    return create_token(
        subject=user.id, institution_id=inst.id, role=user.role, token_type="access"
    )


async def _sesion(client, h, moment_id: str | None = None) -> str:
    resp = await client.post(f"{CHAT}/sessions", headers=h, json={"moment_id": moment_id})
    return resp.json()["session_id"]


async def test_preguntar_guarda_pregunta_y_respuesta(client, db):
    user, inst = await _usuario_con_licencia(db)
    h = _h(_token_de(user, inst))
    sid = await _sesion(client, h)

    resp = await client.post(
        f"{CHAT}/sessions/{sid}/ask", headers=h, json={"question": "hola"}
    )
    mensajes = (await client.get(f"{CHAT}/sessions/{sid}/messages", headers=h)).json()

    assert resp.status_code == 200
    assert [m["role"] for m in mensajes] == ["user", "assistant"]
    assert mensajes[0]["content"] == "hola"


async def test_listar_sesiones_filtra_por_momento(client, db):
    user, inst = await _usuario_con_licencia(db)
    h = _h(_token_de(user, inst))
    # `ChatSession.moment_id` tiene FK a `moments`: hace falta un momento real,
    # no cualquier UUID.
    editor_h = _h(
        create_token(
            subject=uuid.uuid4(),
            institution_id=inst.id,
            role="editor",
            token_type="access",
        )
    )
    proyecto = (
        await client.post(
            "/api/v1/studio/catalog/projects",
            headers=editor_h,
            json={"slug": f"p-{uuid.uuid4().hex[:6]}", "grade": "5", "title": "P"},
        )
    ).json()
    mid = proyecto["moments"][0]["id"]
    await _sesion(client, h, moment_id=mid)
    await _sesion(client, h)

    todas = (await client.get(f"{CHAT}/sessions", headers=h)).json()
    del_momento = (
        await client.get(f"{CHAT}/sessions", headers=h, params={"moment_id": mid})
    ).json()

    assert len(todas) == 2
    assert len(del_momento) == 1


async def test_no_se_pueden_leer_los_mensajes_de_otra_sesion(client, db):
    dueno, inst = await _usuario_con_licencia(db)
    otro, _ = await _usuario_con_licencia(db)
    sid = await _sesion(client, _h(_token_de(dueno, inst)))

    resp = await client.get(
        f"{CHAT}/sessions/{sid}/messages", headers=_h(_token_de(otro, inst))
    )

    assert resp.status_code == 404


async def test_el_guardrail_marca_la_pregunta_no_la_respuesta_enlatada(client, db):
    """C5: lo útil para afinar el clasificador es QUÉ se rechazó."""
    user, inst = await _usuario_con_licencia(db)
    h = _h(_token_de(user, inst))
    sid = await _sesion(client, h)

    app.dependency_overrides[get_assistant_provider] = lambda: StubProvider(
        in_domain=False
    )
    try:
        await client.post(
            f"{CHAT}/sessions/{sid}/ask",
            headers=h,
            json={"question": "quién ganó el mundial?"},
        )
    finally:
        del app.dependency_overrides[get_assistant_provider]

    mensajes = (await client.get(f"{CHAT}/sessions/{sid}/messages", headers=h)).json()
    rechazos = await client.get(
        "/api/v1/studio/assistant/rejections",
        headers=_h(
            create_token(
                subject=user.id, institution_id=inst.id, role="admin", token_type="access"
            )
        ),
    )

    assert mensajes[0]["content"] == "quién ganó el mundial?"
    assert any(r["content"] == "quién ganó el mundial?" for r in rechazos.json())


async def test_rate_limit_devuelve_429(client, db, monkeypatch):
    monkeypatch.setattr(service.settings, "CHAT_RATE_LIMIT_PER_HOUR", 1)
    user, inst = await _usuario_con_licencia(db)
    h = _h(_token_de(user, inst))
    sid = await _sesion(client, h)

    primera = await client.post(
        f"{CHAT}/sessions/{sid}/ask", headers=h, json={"question": "a"}
    )
    segunda = await client.post(
        f"{CHAT}/sessions/{sid}/ask", headers=h, json={"question": "b"}
    )

    assert primera.status_code == 200
    assert segunda.status_code == 429
    assert segunda.json()["error"]["code"] == "rate_limited"


async def test_un_docente_no_estudiante_ve_los_rechazos(client, db):
    user, inst = await _usuario_con_licencia(db, role="student")
    resp = await client.get(
        "/api/v1/studio/assistant/rejections", headers=_h(_token_de(user, inst))
    )
    assert resp.status_code == 403

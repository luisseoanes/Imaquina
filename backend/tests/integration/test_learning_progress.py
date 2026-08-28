"""Progreso lineal del estudiante y panel docente (N5, N6).

Decidido con el cliente: progreso lineal obligatorio -- un momento se
desbloquea solo al completar el anterior. El backend es la frontera real, no
el cliente (que ni debería enlazar a un momento bloqueado).
"""

import uuid
from datetime import date, timedelta

from app.core.security import create_token, hash_password
from app.modules.identity.models import (
    Calendar,
    Course,
    Enrollment,
    Institution,
    License,
    User,
)

CATALOG = "/api/v1/studio/catalog"
PUBLISHING = "/api/v1/studio/publishing"
LEARN = "/api/v1/learn"


def _h(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _institucion_con_licencia(db) -> Institution:
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


def _token_de(user: User, inst: Institution) -> str:
    return create_token(
        subject=user.id, institution_id=inst.id, role=user.role, token_type="access"
    )


async def _proyecto_publicado(client, editor_h) -> str:
    """Los 6 momentos con título y un bloque de texto en ES, publicado."""
    creado = (
        await client.post(
            f"{CATALOG}/projects",
            headers=editor_h,
            json={"slug": f"p-{uuid.uuid4().hex[:6]}", "grade": "5", "title": "P"},
        )
    ).json()
    for m in creado["moments"]:
        await client.patch(
            f"{CATALOG}/moments/{m['id']}", headers=editor_h, json={"title": "T"}
        )
        await client.post(
            f"{CATALOG}/moments/{m['id']}/blocks",
            headers=editor_h,
            json={"kind": "text", "body": "contenido"},
        )
    await client.post(f"{PUBLISHING}/projects/{creado['id']}/publish", headers=editor_h)
    return creado["id"]


async def test_prompt_de_apertura_llega_publicado_al_estudiante(client, db):
    """C3 (R8): el prompt de apertura del CMS sobrevive publicar y llega tal
    cual al camino de lectura del estudiante, no solo al snapshot en unit."""
    inst = await _institucion_con_licencia(db)
    editor = await _usuario(db, inst, "editor")
    editor_h = _h(_token_de(editor, inst))
    creado = (
        await client.post(
            f"{CATALOG}/projects",
            headers=editor_h,
            json={"slug": f"p-{uuid.uuid4().hex[:6]}", "grade": "5", "title": "P"},
        )
    ).json()
    intro = next(m for m in creado["moments"] if m["type"] == "intro")
    await client.patch(
        f"{CATALOG}/moments/{intro['id']}",
        headers=editor_h,
        json={"title": "T", "chatbot_opening_prompt": "¿Qué sabes de robótica?"},
    )
    for m in creado["moments"]:
        if m["id"] == intro["id"]:
            continue
        await client.patch(
            f"{CATALOG}/moments/{m['id']}", headers=editor_h, json={"title": "T"}
        )
    for m in creado["moments"]:
        await client.post(
            f"{CATALOG}/moments/{m['id']}/blocks",
            headers=editor_h,
            json={"kind": "text", "body": "contenido"},
        )
    await client.post(f"{PUBLISHING}/projects/{creado['id']}/publish", headers=editor_h)
    estudiante = await _usuario(db, inst, "student")

    resp = await client.get(
        f"{LEARN}/projects/{creado['id']}/moments/intro",
        headers=_h(_token_de(estudiante, inst)),
    )

    assert resp.json()["chatbot_opening_prompt"] == "¿Qué sabes de robótica?"


async def test_el_estudiante_entra_directo_a_intro(client, db):
    inst = await _institucion_con_licencia(db)
    editor = await _usuario(db, inst, "editor")
    estudiante = await _usuario(db, inst, "student")
    pid = await _proyecto_publicado(client, _h(_token_de(editor, inst)))

    resp = await client.get(
        f"{LEARN}/projects/{pid}/moments/intro", headers=_h(_token_de(estudiante, inst))
    )

    assert resp.status_code == 200


async def test_el_estudiante_no_puede_saltar_al_segundo_momento(client, db):
    inst = await _institucion_con_licencia(db)
    editor = await _usuario(db, inst, "editor")
    estudiante = await _usuario(db, inst, "student")
    pid = await _proyecto_publicado(client, _h(_token_de(editor, inst)))
    h = _h(_token_de(estudiante, inst))

    resp = await client.get(f"{LEARN}/projects/{pid}/moments/inquiry", headers=h)

    assert resp.status_code == 403


async def test_completar_desbloquea_el_siguiente(client, db):
    inst = await _institucion_con_licencia(db)
    editor = await _usuario(db, inst, "editor")
    estudiante = await _usuario(db, inst, "student")
    pid = await _proyecto_publicado(client, _h(_token_de(editor, inst)))
    h = _h(_token_de(estudiante, inst))

    completar = await client.post(
        f"{LEARN}/projects/{pid}/moments/intro/complete", headers=h
    )
    resp = await client.get(f"{LEARN}/projects/{pid}/moments/inquiry", headers=h)

    assert completar.status_code == 204
    assert resp.status_code == 200


async def test_el_docente_no_esta_sujeto_al_bloqueo(client, db):
    """Necesita entrar a cualquier momento para revisar o previsualizar."""
    inst = await _institucion_con_licencia(db)
    editor = await _usuario(db, inst, "editor")
    docente = await _usuario(db, inst, "teacher")
    pid = await _proyecto_publicado(client, _h(_token_de(editor, inst)))

    resp = await client.get(
        f"{LEARN}/projects/{pid}/moments/assess", headers=_h(_token_de(docente, inst))
    )

    assert resp.status_code == 200


async def test_el_endpoint_de_progreso_refleja_lo_completado(client, db):
    inst = await _institucion_con_licencia(db)
    editor = await _usuario(db, inst, "editor")
    estudiante = await _usuario(db, inst, "student")
    pid = await _proyecto_publicado(client, _h(_token_de(editor, inst)))
    h = _h(_token_de(estudiante, inst))
    await client.post(f"{LEARN}/projects/{pid}/moments/intro/complete", headers=h)

    resp = await client.get(f"{LEARN}/projects/{pid}/progress", headers=h)

    progreso = resp.json()
    assert progreso["intro"] == "completed"
    assert progreso["inquiry"] == "not_started"


# --- Panel docente (N6) -------------------------------------------------------


async def test_panel_docente_ve_el_progreso_de_cada_matriculado(client, db):
    inst = await _institucion_con_licencia(db)
    editor = await _usuario(db, inst, "editor")
    docente = await _usuario(db, inst, "teacher")
    estudiante = await _usuario(db, inst, "student")
    pid = await _proyecto_publicado(client, _h(_token_de(editor, inst)))

    curso = Course(institution_id=inst.id, name="5A", grade="5", teacher_id=docente.id)
    db.add(curso)
    await db.flush()
    db.add(Enrollment(course_id=curso.id, user_id=estudiante.id))
    await db.flush()

    await client.post(
        f"{LEARN}/projects/{pid}/moments/intro/complete",
        headers=_h(_token_de(estudiante, inst)),
    )

    resp = await client.get(
        f"{LEARN}/teacher/courses/{curso.id}/progress",
        params={"project_id": pid},
        headers=_h(_token_de(docente, inst)),
    )

    assert resp.status_code == 200
    fila = next(f for f in resp.json() if f["user_id"] == str(estudiante.id))
    assert fila["progress"]["intro"] == "completed"


async def test_un_estudiante_no_ve_el_panel_docente(client, db):
    inst = await _institucion_con_licencia(db)
    estudiante = await _usuario(db, inst, "student")

    resp = await client.get(
        f"{LEARN}/teacher/courses/{uuid.uuid4()}/progress",
        params={"project_id": str(uuid.uuid4())},
        headers=_h(_token_de(estudiante, inst)),
    )

    assert resp.status_code == 403


async def test_el_bloque_de_imagen_llega_al_estudiante_con_su_url(client, db):
    """El snapshot guarda `media_asset_id` a secas: sin resolverlo al servir,
    el estudiante recibe un bloque de imagen sin nada que pintar y el momento
    se ve vacío. Aquí se comprueba el camino de lectura completo."""
    inst = await _institucion_con_licencia(db)
    editor = await _usuario(db, inst, "editor")
    editor_h = _h(_token_de(editor, inst))

    asset = (
        await client.post(
            "/api/v1/studio/media/register",
            headers=editor_h,
            json={
                "s3_key": f"media/{uuid.uuid4().hex}.png",
                "mime_type": "image/png",
                "size_bytes": 1024,
                "original_filename": "robot.png",
                "alt_text": "Un robot",
            },
        )
    ).json()

    creado = (
        await client.post(
            f"{CATALOG}/projects",
            headers=editor_h,
            json={"slug": f"p-{uuid.uuid4().hex[:6]}", "grade": "5", "title": "P"},
        )
    ).json()
    intro = next(m for m in creado["moments"] if m["type"] == "intro")
    for m in creado["moments"]:
        await client.patch(
            f"{CATALOG}/moments/{m['id']}", headers=editor_h, json={"title": "T"}
        )
        await client.post(
            f"{CATALOG}/moments/{m['id']}/blocks",
            headers=editor_h,
            json={"kind": "text", "body": "contenido"},
        )
    await client.post(
        f"{CATALOG}/moments/{intro['id']}/blocks",
        headers=editor_h,
        json={"kind": "image", "media_asset_id": asset["id"], "alt_text": "Un robot"},
    )
    await client.post(f"{PUBLISHING}/projects/{creado['id']}/publish", headers=editor_h)

    estudiante = await _usuario(db, inst, "student")
    est_h = _h(_token_de(estudiante, inst))

    momento = (
        await client.get(f"{LEARN}/projects/{creado['id']}/moments/intro", headers=est_h)
    ).json()
    imagen = next(b for b in momento["blocks"] if b["kind"] == "image")
    assert imagen["url"] and imagen["url"].endswith(".png")
    assert imagen["mime_type"] == "image/png"

    # Y también por la ficha del proyecto, que es de donde sale el índice.
    proyecto = (
        await client.get(f"{LEARN}/projects/{creado['id']}", headers=est_h)
    ).json()
    intro_ficha = next(m for m in proyecto["moments"] if m["type"] == "intro")
    assert next(b for b in intro_ficha["blocks"] if b["kind"] == "image")["url"]

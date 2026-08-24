"""Evaluación de punta a punta (R10, A1-A6).

Constructor de preguntas (editor), intento del estudiante, calificación
automática de mcq/V-F/numérica y manual de las abiertas, tablero docente.
"""

import uuid
from datetime import date, timedelta

from app.core.security import create_token, hash_password
from app.modules.identity.models import Calendar, Institution, License, User

CATALOG = "/api/v1/studio/catalog"
ASSESS = "/api/v1/studio/assessment"
LEARN_ASSESS = "/api/v1/learn/assessments"


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


async def _momento_assess(client, editor_h) -> str:
    creado = (
        await client.post(
            f"{CATALOG}/projects",
            headers=editor_h,
            json={"slug": f"p-{uuid.uuid4().hex[:6]}", "grade": "5", "title": "P"},
        )
    ).json()
    return next(m["id"] for m in creado["moments"] if m["type"] == "assess")


async def test_entrar_al_constructor_crea_la_evaluacion(client, db):
    inst = await _institucion_con_licencia(db)
    editor_h = _h(_token_de(await _usuario(db, inst, "editor"), inst))
    mid = await _momento_assess(client, editor_h)

    primera = await client.get(f"{ASSESS}/moments/{mid}", headers=editor_h)
    segunda = await client.get(f"{ASSESS}/moments/{mid}", headers=editor_h)

    assert primera.status_code == 200
    assert primera.json()["id"] == segunda.json()["id"]  # idempotente


async def test_construir_una_pregunta_mcq_con_opciones(client, db):
    inst = await _institucion_con_licencia(db)
    editor_h = _h(_token_de(await _usuario(db, inst, "editor"), inst))
    mid = await _momento_assess(client, editor_h)
    aid = (await client.get(f"{ASSESS}/moments/{mid}", headers=editor_h)).json()["id"]

    resp = await client.post(
        f"{ASSESS}/{aid}/questions",
        headers=editor_h,
        json={
            "kind": "mcq",
            "prompt": "¿Cuál sensor mide distancia?",
            "points": 2,
            "choices": [
                {"label": "Ultrasónico", "is_correct": True},
                {"label": "LDR", "is_correct": False},
            ],
        },
    )

    assert resp.status_code == 201
    cuerpo = resp.json()
    assert cuerpo["prompt"] == "¿Cuál sensor mide distancia?"
    assert len(cuerpo["choices"]) == 2


async def test_solo_editor_construye_preguntas(client, db):
    inst = await _institucion_con_licencia(db)
    editor_h = _h(_token_de(await _usuario(db, inst, "editor"), inst))
    mid = await _momento_assess(client, editor_h)
    aid = (await client.get(f"{ASSESS}/moments/{mid}", headers=editor_h)).json()["id"]
    docente_h = _h(_token_de(await _usuario(db, inst, "teacher"), inst))

    resp = await client.post(
        f"{ASSESS}/{aid}/questions",
        headers=docente_h,
        json={"kind": "mcq", "prompt": "x", "choices": []},
    )

    assert resp.status_code == 403


async def _evaluacion_completa(client, editor_h) -> tuple[str, dict]:
    """Un assessment con una mcq, una V/F, una numérica y una abierta."""
    mid = await _momento_assess(client, editor_h)
    aid = (await client.get(f"{ASSESS}/moments/{mid}", headers=editor_h)).json()["id"]

    mcq = (
        await client.post(
            f"{ASSESS}/{aid}/questions",
            headers=editor_h,
            json={
                "kind": "mcq",
                "prompt": "mcq",
                "points": 2,
                "choices": [
                    {"label": "correcta", "is_correct": True},
                    {"label": "incorrecta", "is_correct": False},
                ],
            },
        )
    ).json()
    numerica = (
        await client.post(
            f"{ASSESS}/{aid}/questions",
            headers=editor_h,
            json={
                "kind": "numeric",
                "prompt": "numerica",
                "points": 3,
                "correct_numeric": 9.8,
            },
        )
    ).json()
    abierta = (
        await client.post(
            f"{ASSESS}/{aid}/questions",
            headers=editor_h,
            json={"kind": "open", "prompt": "abierta", "points": 5},
        )
    ).json()

    ids = {
        "mcq": mcq,
        "numerica": numerica,
        "abierta": abierta,
        "correcta": mcq["choices"][0]["id"]
        if mcq["choices"][0]["is_correct"]
        else mcq["choices"][1]["id"],
        "incorrecta": mcq["choices"][1]["id"]
        if mcq["choices"][0]["is_correct"]
        else mcq["choices"][0]["id"],
    }
    return aid, ids


async def test_calificacion_automatica_mcq_y_numerica(client, db):
    inst = await _institucion_con_licencia(db)
    editor_h = _h(_token_de(await _usuario(db, inst, "editor"), inst))
    aid, q = await _evaluacion_completa(client, editor_h)
    estudiante = await _usuario(db, inst, "student")
    h = _h(_token_de(estudiante, inst))

    intento = (
        await client.post(f"{LEARN_ASSESS}/{aid}/attempts", headers=h, json={})
    ).json()
    await client.patch(
        f"{LEARN_ASSESS}/attempts/{intento['id']}/answers",
        headers=h,
        json={
            "answers": [
                {"question_id": q["mcq"]["id"], "choice_id": q["correcta"]},
                {"question_id": q["numerica"]["id"], "value_numeric": 9.8},
                {"question_id": q["abierta"]["id"], "value_text": "mi respuesta"},
            ]
        },
    )

    resp = await client.post(f"{LEARN_ASSESS}/attempts/{intento['id']}/submit", headers=h)

    cuerpo = resp.json()
    # 2 (mcq correcta) + 3 (numerica correcta) = 5. La abierta aun no calificada.
    assert cuerpo["score"] == 5
    assert cuerpo["status"] == "submitted"


async def test_una_mcq_incorrecta_no_suma(client, db):
    inst = await _institucion_con_licencia(db)
    editor_h = _h(_token_de(await _usuario(db, inst, "editor"), inst))
    aid, q = await _evaluacion_completa(client, editor_h)
    h = _h(_token_de(await _usuario(db, inst, "student"), inst))

    intento = (
        await client.post(f"{LEARN_ASSESS}/{aid}/attempts", headers=h, json={})
    ).json()
    await client.patch(
        f"{LEARN_ASSESS}/attempts/{intento['id']}/answers",
        headers=h,
        json={"answers": [{"question_id": q["mcq"]["id"], "choice_id": q["incorrecta"]}]},
    )

    resp = await client.post(f"{LEARN_ASSESS}/attempts/{intento['id']}/submit", headers=h)

    assert resp.json()["score"] == 0


async def test_no_se_puede_reintentar_mas_de_max_attempts(client, db):
    inst = await _institucion_con_licencia(db)
    editor_h = _h(_token_de(await _usuario(db, inst, "editor"), inst))
    aid, _ = await _evaluacion_completa(client, editor_h)
    await client.patch(f"{ASSESS}/{aid}", headers=editor_h, json={"max_attempts": 1})
    h = _h(_token_de(await _usuario(db, inst, "student"), inst))

    primero = await client.post(f"{LEARN_ASSESS}/{aid}/attempts", headers=h, json={})
    segundo = await client.post(f"{LEARN_ASSESS}/{aid}/attempts", headers=h, json={})

    assert primero.status_code == 201
    assert segundo.status_code == 409


async def test_calificacion_manual_completa_el_intento(client, db):
    inst = await _institucion_con_licencia(db)
    editor_h = _h(_token_de(await _usuario(db, inst, "editor"), inst))
    aid, q = await _evaluacion_completa(client, editor_h)
    docente_h = _h(_token_de(await _usuario(db, inst, "teacher"), inst))
    h = _h(_token_de(await _usuario(db, inst, "student"), inst))

    intento = (
        await client.post(f"{LEARN_ASSESS}/{aid}/attempts", headers=h, json={})
    ).json()
    await client.patch(
        f"{LEARN_ASSESS}/attempts/{intento['id']}/answers",
        headers=h,
        json={
            "answers": [{"question_id": q["abierta"]["id"], "value_text": "respuesta"}]
        },
    )
    enviado = (
        await client.post(f"{LEARN_ASSESS}/attempts/{intento['id']}/submit", headers=h)
    ).json()
    assert enviado["status"] == "submitted"  # la abierta sigue sin calificar
    answer_id = next(
        a["id"] for a in enviado["answers"] if a["question_id"] == q["abierta"]["id"]
    )

    calificado = await client.patch(
        f"{ASSESS}/answers/{answer_id}",
        headers=docente_h,
        json={"teacher_score": 4, "teacher_feedback": "Bien, falta detalle"},
    )

    assert calificado.status_code == 200
    assert calificado.json()["status"] == "graded"
    assert calificado.json()["score"] == 4


async def test_un_estudiante_no_puede_calificar(client, db):
    inst = await _institucion_con_licencia(db)
    editor_h = _h(_token_de(await _usuario(db, inst, "editor"), inst))
    aid, q = await _evaluacion_completa(client, editor_h)
    h = _h(_token_de(await _usuario(db, inst, "student"), inst))
    intento = (
        await client.post(f"{LEARN_ASSESS}/{aid}/attempts", headers=h, json={})
    ).json()
    await client.patch(
        f"{LEARN_ASSESS}/attempts/{intento['id']}/answers",
        headers=h,
        json={"answers": [{"question_id": q["abierta"]["id"], "value_text": "x"}]},
    )
    enviado = (
        await client.post(f"{LEARN_ASSESS}/attempts/{intento['id']}/submit", headers=h)
    ).json()
    answer_id = enviado["answers"][0]["id"]

    resp = await client.patch(
        f"{ASSESS}/answers/{answer_id}", headers=h, json={"teacher_score": 1}
    )
    assert resp.status_code == 403


async def test_tablero_docente_lista_los_intentos(client, db):
    inst = await _institucion_con_licencia(db)
    editor_h = _h(_token_de(await _usuario(db, inst, "editor"), inst))
    aid, _ = await _evaluacion_completa(client, editor_h)
    docente_h = _h(_token_de(await _usuario(db, inst, "teacher"), inst))
    h = _h(_token_de(await _usuario(db, inst, "student"), inst))
    await client.post(f"{LEARN_ASSESS}/{aid}/attempts", headers=h, json={})

    resp = await client.get(f"{ASSESS}/{aid}/attempts", headers=docente_h)

    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_evaluacion_por_equipo_guarda_la_etiqueta(client, db):
    inst = await _institucion_con_licencia(db)
    editor_h = _h(_token_de(await _usuario(db, inst, "editor"), inst))
    aid, _ = await _evaluacion_completa(client, editor_h)
    await client.patch(f"{ASSESS}/{aid}", headers=editor_h, json={"team_mode": True})
    h = _h(_token_de(await _usuario(db, inst, "student"), inst))

    resp = await client.post(
        f"{LEARN_ASSESS}/{aid}/attempts", headers=h, json={"team_label": "Equipo 3"}
    )

    assert resp.json()["team_label"] == "Equipo 3"


async def test_export_pendiente_hasta_que_el_worker_lo_genera(client, db):
    inst = await _institucion_con_licencia(db)
    editor_h = _h(_token_de(await _usuario(db, inst, "editor"), inst))
    aid, _ = await _evaluacion_completa(client, editor_h)
    docente_h = _h(_token_de(await _usuario(db, inst, "teacher"), inst))

    resp = await client.get(f"{ASSESS}/{aid}/export", headers=docente_h)

    assert resp.json()["status"] == "pendiente"


# --- Vista del estudiante (A8): sin la clave de respuestas -------------------


async def test_el_estudiante_no_ve_cual_opcion_es_correcta(client, db):
    inst = await _institucion_con_licencia(db)
    editor_h = _h(_token_de(await _usuario(db, inst, "editor"), inst))
    mid = await _momento_assess(client, editor_h)
    aid = (await client.get(f"{ASSESS}/moments/{mid}", headers=editor_h)).json()["id"]
    await client.post(
        f"{ASSESS}/{aid}/questions",
        headers=editor_h,
        json={
            "kind": "mcq",
            "prompt": "¿?",
            "choices": [
                {"label": "a", "is_correct": True},
                {"label": "b", "is_correct": False},
            ],
        },
    )
    await client.post(
        f"{ASSESS}/{aid}/questions",
        headers=editor_h,
        json={"kind": "numeric", "prompt": "num", "correct_numeric": 42},
    )
    h = _h(_token_de(await _usuario(db, inst, "student"), inst))

    resp = await client.get(f"{LEARN_ASSESS}/moments/{mid}", headers=h)

    cuerpo = resp.json()
    assert resp.status_code == 200
    for pregunta in cuerpo["questions"]:
        assert "correct_numeric" not in pregunta
        for opcion in pregunta["choices"]:
            assert "is_correct" not in opcion


async def test_un_momento_sin_evaluacion_da_404(client, db):
    inst = await _institucion_con_licencia(db)
    editor_h = _h(_token_de(await _usuario(db, inst, "editor"), inst))
    creado = (
        await client.post(
            f"{CATALOG}/projects",
            headers=editor_h,
            json={"slug": f"p-{uuid.uuid4().hex[:6]}", "grade": "5", "title": "P"},
        )
    ).json()
    mid = next(m["id"] for m in creado["moments"] if m["type"] == "intro")
    h = _h(_token_de(await _usuario(db, inst, "student"), inst))

    resp = await client.get(f"{LEARN_ASSESS}/moments/{mid}", headers=h)

    assert resp.status_code == 404


async def test_mis_intentos_no_muestra_los_de_otro_estudiante(client, db):
    inst = await _institucion_con_licencia(db)
    editor_h = _h(_token_de(await _usuario(db, inst, "editor"), inst))
    aid, _ = await _evaluacion_completa(client, editor_h)
    h1 = _h(_token_de(await _usuario(db, inst, "student"), inst))
    h2 = _h(_token_de(await _usuario(db, inst, "student"), inst))
    await client.post(f"{LEARN_ASSESS}/{aid}/attempts", headers=h1, json={})
    await client.post(f"{LEARN_ASSESS}/{aid}/attempts", headers=h2, json={})

    mios = await client.get(f"{LEARN_ASSESS}/{aid}/attempts/mine", headers=h1)

    assert len(mios.json()) == 1

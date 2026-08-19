"""Autoría del catálogo (S1).

Dos cosas que se prueban aquí y no en unitarios: que el guard de rol es del
servidor y no de React, y que borrar no puede llevarse por delante el snapshot
del que se sirven los estudiantes.
"""

import uuid
from datetime import date, timedelta

import pytest

from app.core.security import create_token, hash_password
from app.modules.catalog.models import MOMENT_ORDER, Project, ProjectStatus
from app.modules.identity.models import Calendar, Institution, License, User

BASE = "/api/v1/studio/catalog/projects"


async def _token(db, role: str) -> str:
    inst = Institution(name=f"Colegio {role}", calendar=Calendar.A)
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
        email=f"{role}-{uuid.uuid4().hex[:6]}@imaquina.example.com",
        full_name=role,
        password_hash=hash_password("x"),
        role=role,
        institution_id=inst.id,
    )
    db.add(user)
    await db.flush()
    return create_token(
        subject=user.id, institution_id=inst.id, role=role, token_type="access"
    )


def _h(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize("role", ["student", "teacher"])
async def test_el_studio_no_es_para_estudiantes_ni_docentes(client, db, role):
    """El docente ve la guía didáctica, pero el editor es de editor/admin."""
    resp = await client.get(BASE, headers=_h(await _token(db, role)))

    assert resp.status_code == 403


async def test_sin_token_da_401(client):
    assert (await client.get(BASE)).status_code == 401


async def test_crear_y_recuperar_un_proyecto(client, db):
    h = _h(await _token(db, "editor"))

    creado = await client.post(
        BASE,
        headers=h,
        json={"slug": "semaforo", "grade": "5", "title": "Semáforo", "kit": "Kit A"},
    )

    assert creado.status_code == 201
    cuerpo = creado.json()
    assert cuerpo["title"] == "Semáforo"
    assert cuerpo["status"] == ProjectStatus.DRAFT
    assert cuerpo["langs"] == ["es"]

    detalle = await client.get(f"{BASE}/{cuerpo['id']}", headers=h)
    assert detalle.json()["kit"] == "Kit A"


async def test_el_slug_repetido_da_conflicto_no_error_500(client, db):
    h = _h(await _token(db, "editor"))
    cuerpo = {"slug": "repetido", "grade": "5", "title": "Uno"}
    await client.post(BASE, headers=h, json=cuerpo)

    resp = await client.post(BASE, headers=h, json={**cuerpo, "title": "Otro"})

    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "conflict"


async def test_el_patch_es_parcial(client, db):
    h = _h(await _token(db, "editor"))
    pid = (
        await client.post(
            BASE,
            headers=h,
            json={"slug": "p1", "grade": "5", "title": "Original", "kit": "Kit A"},
        )
    ).json()["id"]

    resp = await client.patch(f"{BASE}/{pid}", headers=h, json={"grade": "6"})

    assert resp.status_code == 200
    assert resp.json()["grade"] == "6"
    # Lo que no vino en el patch sigue intacto.
    assert resp.json()["title"] == "Original"
    assert resp.json()["kit"] == "Kit A"


async def test_el_patch_traduce_a_otro_idioma_sin_pisar_el_espanol(client, db):
    h = _h(await _token(db, "editor"))
    pid = (
        await client.post(
            BASE, headers=h, json={"slug": "p2", "grade": "5", "title": "Semáforo"}
        )
    ).json()["id"]

    await client.patch(
        f"{BASE}/{pid}", headers=h, json={"lang": "en", "title": "Traffic light"}
    )

    en = await client.get(f"{BASE}/{pid}?lang=en", headers=h)
    es = await client.get(f"{BASE}/{pid}?lang=es", headers=h)
    assert en.json()["title"] == "Traffic light"
    assert es.json()["title"] == "Semáforo"
    assert es.json()["langs"] == ["en", "es"]


async def test_no_se_puede_borrar_un_proyecto_publicado(client, db):
    """`project_versions` cuelga con CASCADE: borrarlo dejaría a los
    estudiantes sin el snapshot en mitad del semestre."""
    h = _h(await _token(db, "editor"))
    pid = (
        await client.post(
            BASE, headers=h, json={"slug": "publicado", "grade": "5", "title": "P"}
        )
    ).json()["id"]
    proyecto = await db.get(Project, uuid.UUID(pid))
    proyecto.status = ProjectStatus.PUBLISHED
    await db.flush()

    resp = await client.delete(f"{BASE}/{pid}", headers=h)

    assert resp.status_code == 409
    assert (await client.get(f"{BASE}/{pid}", headers=h)).status_code == 200


async def test_un_borrador_si_se_borra(client, db):
    h = _h(await _token(db, "editor"))
    pid = (
        await client.post(
            BASE, headers=h, json={"slug": "borrador", "grade": "5", "title": "B"}
        )
    ).json()["id"]

    assert (await client.delete(f"{BASE}/{pid}", headers=h)).status_code == 204
    assert (await client.get(f"{BASE}/{pid}", headers=h)).status_code == 404


async def test_el_listado_del_editor_incluye_borradores(client, db):
    """A diferencia del de learning, que sólo ve publicados."""
    h = _h(await _token(db, "editor"))
    await client.post(
        BASE, headers=h, json={"slug": "draft-1", "grade": "5", "title": "Borrador"}
    )

    slugs = [p["slug"] for p in (await client.get(BASE, headers=h)).json()]
    assert "draft-1" in slugs


async def test_el_proyecto_nace_con_los_seis_momentos_en_orden(client, db):
    """R7: los seis momentos son fijos. El editor los rellena, no los inventa.

    Si pudiera añadirlos a mano acabaría habiendo proyectos con cinco, o con el
    orden cambiado, y cada estudiante vería un recorrido distinto.
    """
    h = _h(await _token(db, "editor"))

    creado = await client.post(
        BASE, headers=h, json={"slug": "nuevo", "grade": "5", "title": "Nuevo"}
    )

    momentos = creado.json()["moments"]
    assert [m["type"] for m in momentos] == list(MOMENT_ORDER)
    assert [m["order"] for m in momentos] == list(range(len(MOMENT_ORDER)))


async def test_los_momentos_nacen_vacios_para_que_el_editor_los_llene(client, db):
    h = _h(await _token(db, "editor"))

    creado = await client.post(
        BASE, headers=h, json={"slug": "vacio", "grade": "5", "title": "Vacío"}
    )

    for m in creado.json()["moments"]:
        assert m["title"] is None
        assert m["blocks"] == 0
        assert m["langs"] == []


async def test_crear_y_consultar_devuelven_la_misma_forma(client, db):
    h = _h(await _token(db, "editor"))
    creado = (
        await client.post(
            BASE, headers=h, json={"slug": "igual", "grade": "5", "title": "Igual"}
        )
    ).json()

    detalle = (await client.get(f"{BASE}/{creado['id']}", headers=h)).json()

    assert creado == detalle


async def test_el_listado_no_arrastra_los_momentos(client, db):
    """Serían seis joins por fila para pintar una tabla que no los muestra."""
    h = _h(await _token(db, "editor"))
    await client.post(
        BASE, headers=h, json={"slug": "listado", "grade": "5", "title": "L"}
    )

    ficha = (await client.get(BASE, headers=h)).json()[0]
    assert "moments" not in ficha


async def test_un_proyecto_recien_creado_no_es_publicable_todavia(client, db):
    """Los momentos existen pero están vacíos: la validación tiene que verlo."""
    h = _h(await _token(db, "editor"))
    pid = (
        await client.post(
            BASE, headers=h, json={"slug": "sinllenar", "grade": "5", "title": "S"}
        )
    ).json()["id"]

    resp = await client.post(
        f"/api/v1/studio/publishing/projects/{pid}/validate", headers=h
    )

    problemas = resp.json()["problems"]
    assert problemas, "un proyecto vacío no puede darse por publicable"
    assert any("no tiene contenido" in p for p in problemas)


# --- Bloques (S3) ----------------------------------------------------------

BLOQUES = "/api/v1/studio/catalog"


async def _momento_intro(client, h) -> str:
    """Un proyecto nuevo ya trae sus seis momentos vacíos (S2)."""
    creado = await client.post(
        BASE,
        headers=h,
        json={"slug": f"p-{uuid.uuid4().hex[:6]}", "grade": "5", "title": "P"},
    )
    return next(m["id"] for m in creado.json()["moments"] if m["type"] == "intro")


async def test_los_bloques_se_anaden_al_final(client, db):
    h = _h(await _token(db, "editor"))
    mid = await _momento_intro(client, h)

    for texto in ("primero", "segundo", "tercero"):
        await client.post(
            f"{BLOQUES}/moments/{mid}/blocks",
            headers=h,
            json={"kind": "text", "body": texto},
        )

    bloques = (await client.get(f"{BLOQUES}/moments/{mid}/blocks", headers=h)).json()
    assert [b["order"] for b in bloques] == [0, 1, 2]
    assert [b["body"] for b in bloques] == ["primero", "segundo", "tercero"]


async def test_el_patch_de_un_bloque_es_parcial(client, db):
    h = _h(await _token(db, "editor"))
    mid = await _momento_intro(client, h)
    bid = (
        await client.post(
            f"{BLOQUES}/moments/{mid}/blocks",
            headers=h,
            json={"kind": "image", "alt_text": "Un semáforo", "caption": "Fig. 1"},
        )
    ).json()["id"]

    resp = await client.patch(
        f"{BLOQUES}/blocks/{bid}", headers=h, json={"caption": "Figura 1"}
    )

    assert resp.json()["caption"] == "Figura 1"
    assert resp.json()["alt_text"] == "Un semáforo"
    assert resp.json()["kind"] == "image"


async def test_traducir_un_bloque_no_pisa_el_otro_idioma(client, db):
    h = _h(await _token(db, "editor"))
    mid = await _momento_intro(client, h)
    bid = (
        await client.post(
            f"{BLOQUES}/moments/{mid}/blocks",
            headers=h,
            json={"kind": "text", "body": "Conecta el motor"},
        )
    ).json()["id"]

    await client.patch(
        f"{BLOQUES}/blocks/{bid}",
        headers=h,
        json={"lang": "en", "body": "Connect the motor"},
    )

    es = (await client.get(f"{BLOQUES}/moments/{mid}/blocks?lang=es", headers=h)).json()
    en = (await client.get(f"{BLOQUES}/moments/{mid}/blocks?lang=en", headers=h)).json()
    assert es[0]["body"] == "Conecta el motor"
    assert en[0]["body"] == "Connect the motor"
    assert es[0]["langs"] == ["en", "es"]


async def test_reordenar_reasigna_el_orden_completo(client, db):
    h = _h(await _token(db, "editor"))
    mid = await _momento_intro(client, h)
    ids = [
        (
            await client.post(
                f"{BLOQUES}/moments/{mid}/blocks",
                headers=h,
                json={"kind": "text", "body": t},
            )
        ).json()["id"]
        for t in ("a", "b", "c")
    ]

    resp = await client.put(
        f"{BLOQUES}/moments/{mid}/blocks/order",
        headers=h,
        json={"block_ids": [ids[2], ids[0], ids[1]]},
    )

    assert [b["body"] for b in resp.json()] == ["c", "a", "b"]
    assert [b["order"] for b in resp.json()] == [0, 1, 2]


async def test_un_reordenamiento_incompleto_se_rechaza(client, db):
    """Media lista dejaría bloques con el orden viejo y duplicados."""
    h = _h(await _token(db, "editor"))
    mid = await _momento_intro(client, h)
    ids = [
        (
            await client.post(
                f"{BLOQUES}/moments/{mid}/blocks",
                headers=h,
                json={"kind": "text", "body": t},
            )
        ).json()["id"]
        for t in ("a", "b")
    ]

    resp = await client.put(
        f"{BLOQUES}/moments/{mid}/blocks/order", headers=h, json={"block_ids": [ids[0]]}
    )

    assert resp.status_code == 422


async def test_un_asset_de_media_inexistente_da_422_no_500(client, db):
    h = _h(await _token(db, "editor"))
    mid = await _momento_intro(client, h)

    resp = await client.post(
        f"{BLOQUES}/moments/{mid}/blocks",
        headers=h,
        json={"kind": "image", "media_asset_id": str(uuid.uuid4())},
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_failed"


async def test_borrar_un_bloque(client, db):
    h = _h(await _token(db, "editor"))
    mid = await _momento_intro(client, h)
    bid = (
        await client.post(
            f"{BLOQUES}/moments/{mid}/blocks", headers=h, json={"kind": "text"}
        )
    ).json()["id"]

    assert (await client.delete(f"{BLOQUES}/blocks/{bid}", headers=h)).status_code == 204
    assert (await client.get(f"{BLOQUES}/moments/{mid}/blocks", headers=h)).json() == []


async def test_un_kind_invalido_se_rechaza(client, db):
    h = _h(await _token(db, "editor"))
    mid = await _momento_intro(client, h)

    resp = await client.post(
        f"{BLOQUES}/moments/{mid}/blocks", headers=h, json={"kind": "gif-animado"}
    )

    assert resp.status_code == 422


async def test_los_bloques_tampoco_son_para_docentes(client, db):
    h = _h(await _token(db, "teacher"))

    resp = await client.get(f"{BLOQUES}/moments/{uuid.uuid4()}/blocks", headers=h)

    assert resp.status_code == 403


# --- Momentos y traducción (S4, S5) ----------------------------------------


async def _proyecto_con_momento(client, h) -> tuple[str, str]:
    creado = (
        await client.post(
            BASE,
            headers=h,
            json={"slug": f"t-{uuid.uuid4().hex[:6]}", "grade": "5", "title": "P"},
        )
    ).json()
    mid = next(m["id"] for m in creado["moments"] if m["type"] == "intro")
    return creado["id"], mid


async def test_editar_guia_docente_y_prompt_de_apertura(client, db):
    """R4 y R8: los dos viven en el momento y son por idioma."""
    h = _h(await _token(db, "editor"))
    _, mid = await _proyecto_con_momento(client, h)

    resp = await client.patch(
        f"{BLOQUES}/moments/{mid}",
        headers=h,
        json={
            "title": "Introducción",
            "teacher_note": "Formar equipos de 4",
            "chatbot_opening_prompt": "¿Qué sabes de semáforos?",
        },
    )

    assert resp.json()["teacher_note"] == "Formar equipos de 4"
    assert resp.json()["chatbot_opening_prompt"] == "¿Qué sabes de semáforos?"


async def test_el_studio_no_oculta_la_guia_docente(client, db):
    """Aquí sí se ve: quien entra es editor. El filtro es del camino de lectura
    (`learning.serialize_moment_for`), no del editor."""
    h = _h(await _token(db, "editor"))
    _, mid = await _proyecto_con_momento(client, h)
    await client.patch(
        f"{BLOQUES}/moments/{mid}", headers=h, json={"teacher_note": "secreto"}
    )

    assert (await client.get(f"{BLOQUES}/moments/{mid}", headers=h)).json()[
        "teacher_note"
    ] == "secreto"


async def test_los_momentos_no_se_crean_ni_se_borran(client, db):
    """R7: son seis y fijos. Sin POST ni DELETE en el router."""
    h = _h(await _token(db, "editor"))
    _, mid = await _proyecto_con_momento(client, h)

    # DELETE sobre una ruta que existe para GET/PATCH -> 405.
    assert (await client.delete(f"{BLOQUES}/moments/{mid}", headers=h)).status_code == 405
    # Y no hay ruta de creacion en absoluto -> 404.
    creacion = await client.post(f"{BLOQUES}/moments", headers=h, json={})
    assert creacion.status_code == 404


async def test_traducir_un_momento_no_pisa_el_otro_idioma(client, db):
    h = _h(await _token(db, "editor"))
    _, mid = await _proyecto_con_momento(client, h)
    await client.patch(f"{BLOQUES}/moments/{mid}", headers=h, json={"title": "Diseño"})

    await client.patch(
        f"{BLOQUES}/moments/{mid}", headers=h, json={"lang": "en", "title": "Design"}
    )

    es = await client.get(f"{BLOQUES}/moments/{mid}?lang=es", headers=h)
    en = await client.get(f"{BLOQUES}/moments/{mid}?lang=en", headers=h)
    assert es.json()["title"] == "Diseño"
    assert en.json()["title"] == "Design"
    assert es.json()["langs"] == ["en", "es"]


async def test_el_estado_de_traduccion_dice_QUE_falta(client, db):
    """Un booleano no sirve: el editor necesita saber qué rellenar."""
    h = _h(await _token(db, "editor"))
    pid, _ = await _proyecto_con_momento(client, h)

    resp = await client.get(f"{BASE}/{pid}/translations", headers=h)
    estado = {e["lang"]: e for e in resp.json()}

    assert estado["es"]["complete"] is False
    assert any("no tiene título" in m for m in estado["es"]["missing"])
    # El inglés ni siquiera tiene título de proyecto.
    assert any("título del proyecto" in m for m in estado["en"]["missing"])


async def test_un_idioma_con_titulos_pero_bloques_vacios_no_esta_completo(client, db):
    """El agujero real: si solo se miran los títulos, un idioma entra al
    snapshot con todos los bloques en blanco y el estudiante ve el momento
    vacío."""
    h = _h(await _token(db, "editor"))
    pid, _ = await _proyecto_con_momento(client, h)
    detalle = (await client.get(f"{BASE}/{pid}", headers=h)).json()

    for m in detalle["moments"]:
        await client.patch(
            f"{BLOQUES}/moments/{m['id']}", headers=h, json={"title": f"T {m['type']}"}
        )
        await client.post(
            f"{BLOQUES}/moments/{m['id']}/blocks",
            headers=h,
            json={"kind": "text", "body": "contenido"},
        )
        # el mismo bloque en inglés se queda SIN cuerpo
        await client.patch(
            f"{BLOQUES}/moments/{m['id']}", headers=h, json={"lang": "en", "title": "T"}
        )
    await client.patch(f"{BASE}/{pid}", headers=h, json={"lang": "en", "title": "EN"})

    resp = await client.get(f"{BASE}/{pid}/translations", headers=h)
    estado = {e["lang"]: e for e in resp.json()}

    assert estado["es"]["complete"] is True
    assert estado["en"]["complete"] is False
    assert any("no tiene texto" in m for m in estado["en"]["missing"])


async def test_una_imagen_sin_alt_no_cuenta_como_traducida(client, db):
    """El alt es obligatorio por accesibilidad, no decorativo."""
    h = _h(await _token(db, "editor"))
    pid, mid = await _proyecto_con_momento(client, h)
    await client.post(
        f"{BLOQUES}/moments/{mid}/blocks", headers=h, json={"kind": "image"}
    )

    resp = await client.get(f"{BASE}/{pid}/translations", headers=h)
    estado = {e["lang"]: e for e in resp.json()}

    assert any("no tiene alt_text" in m for m in estado["es"]["missing"])

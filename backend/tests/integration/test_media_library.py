"""Librería de media (S10).

El binario nunca pasa por FastAPI: aquí sólo se administra el registro. Lo que
de verdad se prueba es el guardarraíl de borrado — `content_blocks.media_asset_id`
tiene ON DELETE SET NULL, así que borrar un asset en uso dejaría los bloques
apuntando a nada, sin aviso y quizá en un proyecto ya publicado.
"""

import uuid
from datetime import date, timedelta

import pytest

from app.core.security import create_token, hash_password
from app.modules.identity.models import Calendar, Institution, License, User

MEDIA = "/api/v1/studio/media"
CATALOG = "/api/v1/studio/catalog"


async def _token(db, role: str = "editor") -> str:
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


async def _registrar(client, h, *, nombre="foto.png", mime="image/png") -> str:
    resp = await client.post(
        f"{MEDIA}/register",
        headers=h,
        json={
            "s3_key": f"media/2026/08/{uuid.uuid4()}/{nombre}",
            "mime_type": mime,
            "size_bytes": 1024,
            "original_filename": nombre,
            "alt_text": "Una foto",
        },
    )
    return resp.json()["id"]


async def test_la_libreria_lista_lo_registrado(client, db):
    h = _h(await _token(db))
    await _registrar(client, h, nombre="chasis.png")

    resp = await client.get(f"{MEDIA}/assets", headers=h)

    cuerpo = resp.json()
    assert cuerpo["total"] == 1
    assert cuerpo["items"][0]["original_filename"] == "chasis.png"
    assert cuerpo["items"][0]["used_in"] == 0


async def test_filtra_por_familia_no_por_mime_exacto(client, db):
    """El editor filtra por "imágenes", no por "image/webp"."""
    h = _h(await _token(db))
    await _registrar(client, h, nombre="a.png", mime="image/png")
    await _registrar(client, h, nombre="b.mp4", mime="video/mp4")

    imagenes = await client.get(f"{MEDIA}/assets?familia=image", headers=h)

    assert imagenes.json()["total"] == 1
    assert imagenes.json()["items"][0]["mime_type"] == "image/png"


async def test_una_familia_invalida_se_rechaza(client, db):
    h = _h(await _token(db))

    resp = await client.get(f"{MEDIA}/assets?familia=gifs", headers=h)

    assert resp.status_code == 422


async def test_busca_por_nombre_de_fichero(client, db):
    h = _h(await _token(db))
    await _registrar(client, h, nombre="motor-dc.png")
    await _registrar(client, h, nombre="servo.png")

    resp = await client.get(f"{MEDIA}/assets?buscar=motor", headers=h)

    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["original_filename"] == "motor-dc.png"


async def test_la_libreria_esta_paginada(client, db):
    """Es reutilizable, así que crece: paginada desde el día 1."""
    h = _h(await _token(db))
    for i in range(3):
        await _registrar(client, h, nombre=f"f{i}.png")

    pagina = await client.get(f"{MEDIA}/assets?limit=2&offset=0", headers=h)

    assert pagina.json()["total"] == 3
    assert len(pagina.json()["items"]) == 2


async def test_un_asset_sin_usar_se_borra(client, db):
    h = _h(await _token(db))
    aid = await _registrar(client, h)

    assert (await client.delete(f"{MEDIA}/assets/{aid}", headers=h)).status_code == 204
    assert (await client.get(f"{MEDIA}/assets", headers=h)).json()["total"] == 0


async def test_no_se_borra_un_asset_en_uso(client, db):
    """ON DELETE SET NULL: borrarlo dejaría el bloque apuntando a nada."""
    h = _h(await _token(db))
    aid = await _registrar(client, h)
    proyecto = (
        await client.post(
            CATALOG + "/projects",
            headers=h,
            json={"slug": f"p-{uuid.uuid4().hex[:6]}", "grade": "5", "title": "P"},
        )
    ).json()
    mid = proyecto["moments"][0]["id"]
    await client.post(
        f"{CATALOG}/moments/{mid}/blocks",
        headers=h,
        json={"kind": "image", "media_asset_id": aid, "alt_text": "x"},
    )

    resp = await client.delete(f"{MEDIA}/assets/{aid}", headers=h)

    assert resp.status_code == 409
    # Y el bloque sigue apuntando al asset, no se ha quedado a medias.
    bloques = (await client.get(f"{CATALOG}/moments/{mid}/blocks", headers=h)).json()
    assert bloques[0]["media_asset_id"] == aid


async def test_el_listado_dice_cuantas_veces_se_usa(client, db):
    """Para avisar ANTES de intentar borrar, no con un 409 en la cara."""
    h = _h(await _token(db))
    aid = await _registrar(client, h)
    proyecto = (
        await client.post(
            CATALOG + "/projects",
            headers=h,
            json={"slug": f"p-{uuid.uuid4().hex[:6]}", "grade": "5", "title": "P"},
        )
    ).json()
    for m in proyecto["moments"][:2]:
        await client.post(
            f"{CATALOG}/moments/{m['id']}/blocks",
            headers=h,
            json={"kind": "image", "media_asset_id": aid, "alt_text": "x"},
        )

    resp = await client.get(f"{MEDIA}/assets", headers=h)

    assert resp.json()["items"][0]["used_in"] == 2


async def test_borrar_algo_que_no_existe_da_404(client, db):
    h = _h(await _token(db))

    resp = await client.delete(f"{MEDIA}/assets/{uuid.uuid4()}", headers=h)

    assert resp.status_code == 404


@pytest.mark.parametrize("role", ["student", "teacher"])
async def test_la_libreria_es_de_editores(client, db, role):
    h = _h(await _token(db, role))

    assert (await client.get(f"{MEDIA}/assets", headers=h)).status_code == 403

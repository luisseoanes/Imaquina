"""Publicación contra Postgres real.

Los tests unitarios de publishing construyen los objetos en memoria, así que
las relaciones ya vienen cargadas y nunca ejercitan el ORM async. Eso escondía
que `_load_full` no traía `ContentBlock.translations`: contra una base de
verdad, `build_snapshot` disparaba un lazy load y reventaba con
`MissingGreenlet`. Publicar no funcionaba y ningún test lo veía.
"""

import uuid

from app.modules.catalog.models import (
    MOMENT_ORDER,
    BlockKind,
    BlockTranslation,
    ContentBlock,
    Moment,
    MomentTranslation,
    Project,
    ProjectTranslation,
)
from app.modules.publishing import service as publishing


async def _proyecto_completo(db) -> Project:
    proyecto = Project(slug=f"p-{uuid.uuid4().hex[:8]}", grade="5", order=1)
    db.add(proyecto)
    await db.flush()
    db.add(
        ProjectTranslation(project_id=proyecto.id, lang="es", title="Semaforo")
    )

    for orden, tipo in enumerate(MOMENT_ORDER):
        momento = Moment(project_id=proyecto.id, type=tipo, order=orden)
        db.add(momento)
        await db.flush()
        db.add(
            MomentTranslation(
                moment_id=momento.id,
                lang="es",
                title=f"Momento {tipo}",
                teacher_note=f"guia de {tipo}",
            )
        )
        bloque = ContentBlock(moment_id=momento.id, kind=BlockKind.TEXT, order=0)
        db.add(bloque)
        await db.flush()
        db.add(
            BlockTranslation(
                block_id=bloque.id, lang="es", body=f"cuerpo de {tipo}"
            )
        )

    await db.flush()
    return proyecto


async def test_publicar_serializa_el_cuerpo_de_los_bloques(db):
    """El caso que fallaba: leer las traducciones del bloque desde la BD."""
    proyecto = await _proyecto_completo(db)

    version = await publishing.publish(db, proyecto.id, published_by=None)

    momentos = {m["type"]: m for m in version.snapshot["moments"]}
    assert len(momentos) == len(MOMENT_ORDER)
    for tipo in MOMENT_ORDER:
        bloques = momentos[tipo]["blocks"]
        assert bloques, f"el momento '{tipo}' quedó sin bloques en el snapshot"
        assert bloques[0]["body"] == f"cuerpo de {tipo}"


async def test_el_snapshot_conserva_la_guia_docente(db):
    """Se guarda en el snapshot a propósito; el filtro por rol es al servir."""
    proyecto = await _proyecto_completo(db)

    version = await publishing.publish(db, proyecto.id, published_by=None)

    intro = next(m for m in version.snapshot["moments"] if m["type"] == "intro")
    assert intro["teacher_note"] == "guia de intro"


async def test_publicar_dos_veces_deja_una_sola_version_vigente(db):
    proyecto = await _proyecto_completo(db)

    primera = await publishing.publish(db, proyecto.id, published_by=None)
    segunda = await publishing.publish(db, proyecto.id, published_by=None)

    await db.refresh(primera)
    assert primera.version == 1 and segunda.version == 2
    assert not primera.is_current
    assert segunda.is_current

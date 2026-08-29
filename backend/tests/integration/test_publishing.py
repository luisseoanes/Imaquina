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
    ProjectStatus,
    ProjectTranslation,
)
from app.modules.publishing import service as publishing


async def _proyecto_completo(db, *, langs=("es",)) -> Project:
    proyecto = Project(
        slug=f"p-{uuid.uuid4().hex[:8]}",
        grade="5",
        order=1,
        status=ProjectStatus.APPROVED,
    )
    db.add(proyecto)
    await db.flush()
    for lang in langs:
        db.add(
            ProjectTranslation(
                project_id=proyecto.id, lang=lang, title=f"Semaforo {lang}"
            )
        )

    for orden, tipo in enumerate(MOMENT_ORDER):
        momento = Moment(project_id=proyecto.id, type=tipo, order=orden)
        db.add(momento)
        await db.flush()
        for lang in langs:
            db.add(
                MomentTranslation(
                    moment_id=momento.id,
                    lang=lang,
                    title=f"Momento {tipo} {lang}",
                    teacher_note=f"guia de {tipo} en {lang}",
                )
            )
        bloque = ContentBlock(moment_id=momento.id, kind=BlockKind.TEXT, order=0)
        db.add(bloque)
        await db.flush()
        for lang in langs:
            db.add(
                BlockTranslation(
                    block_id=bloque.id, lang=lang, body=f"cuerpo de {tipo} en {lang}"
                )
            )

    await db.flush()
    return proyecto


async def test_publicar_serializa_el_cuerpo_de_los_bloques(db):
    """El caso que fallaba: leer las traducciones del bloque desde la BD."""
    proyecto = await _proyecto_completo(db)

    version = await publishing.publish(db, proyecto.id, published_by=None)

    es = version.snapshot["content"]["es"]
    momentos = {m["type"]: m for m in es["moments"]}
    assert len(momentos) == len(MOMENT_ORDER)
    for tipo in MOMENT_ORDER:
        bloques = momentos[tipo]["blocks"]
        assert bloques, f"el momento '{tipo}' quedó sin bloques en el snapshot"
        assert bloques[0]["body"] == f"cuerpo de {tipo} en es"


async def test_el_snapshot_conserva_la_guia_docente(db):
    """Se guarda en el snapshot a propósito; el filtro por rol es al servir."""
    proyecto = await _proyecto_completo(db)

    version = await publishing.publish(db, proyecto.id, published_by=None)

    momentos = version.snapshot["content"]["es"]["moments"]
    intro = next(m for m in momentos if m["type"] == "intro")
    assert intro["teacher_note"] == "guia de intro en es"


async def test_publicar_dos_veces_deja_una_sola_version_vigente(db):
    proyecto = await _proyecto_completo(db)

    primera = await publishing.publish(db, proyecto.id, published_by=None)
    segunda = await publishing.publish(db, proyecto.id, published_by=None)

    await db.refresh(primera)
    assert primera.version == 1 and segunda.version == 2
    assert not primera.is_current
    assert segunda.is_current


async def test_una_sola_version_lleva_los_dos_idiomas(db):
    """R6: publicar en inglés NO puede sustituir a la versión española.

    Solo hay una `is_current`, así que un snapshot por idioma dejaba la
    plataforma bilingüe servida en un único idioma.
    """
    proyecto = await _proyecto_completo(db, langs=("es", "en"))

    version = await publishing.publish(db, proyecto.id, published_by=None)

    assert sorted(version.snapshot["langs"]) == ["en", "es"]
    assert version.snapshot["content"]["en"]["title"] == "Semaforo en"
    assert version.snapshot["content"]["es"]["title"] == "Semaforo es"


async def test_un_idioma_a_medias_no_se_publica(db):
    """Media traducción serviría contenido incompleto al estudiante."""
    proyecto = await _proyecto_completo(db, langs=("es",))
    # db.add y no `proyecto.translations.append`: la relación no está cargada
    # y appendear dispara un lazy load (MissingGreenlet en async).
    db.add(
        ProjectTranslation(project_id=proyecto.id, lang="en", title="Traffic light")
    )
    await db.flush()

    version = await publishing.publish(db, proyecto.id, published_by=None)

    # Tiene título en inglés pero los momentos no: fuera.
    assert version.snapshot["langs"] == ["es"]


async def test_despublicar_vuelve_a_borrador_sin_borrar_el_historial(db):
    """S18: el mensaje de error al borrar promete esta acción — tiene que existir."""
    proyecto = await _proyecto_completo(db)
    version = await publishing.publish(db, proyecto.id, published_by=None)

    actualizado = await publishing.unpublish(db, proyecto.id)

    assert actualizado.status == ProjectStatus.DRAFT
    # El snapshot sigue ahí: un republicar no debería tener que reconstruir
    # desde cero, y el rollback sigue teniendo algo a lo que volver.
    await db.refresh(version)
    assert version.snapshot is not None

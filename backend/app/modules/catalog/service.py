"""Autoria del catalogo: el lado de ESCRITURA del Content Studio.

Camino de escritura, no de lectura (arquitectura.md 3.1): aqui se trabaja
contra las tablas normalizadas. Los estudiantes nunca pasan por aqui — leen
del snapshot publicado, que arma `publishing`.

Validacion al PUBLICAR, no al escribir: un proyecto a medio hacer se puede
guardar sin problema. Lo unico que se exige aqui es lo que romperia la base.
"""

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import Conflict, NotFound, ValidationFailed
from app.modules.catalog.models import (
    MOMENT_ORDER,
    BlockTranslation,
    ContentBlock,
    Moment,
    MomentTranslation,
    Project,
    ProjectStatus,
    ProjectTranslation,
)
from app.modules.media import service as media


async def _get(
    db: AsyncSession, project_id: uuid.UUID, *, con_momentos: bool = False
) -> Project:
    opciones = [selectinload(Project.translations)]
    if con_momentos:
        opciones += [
            selectinload(Project.moments).selectinload(Moment.translations),
            selectinload(Project.moments).selectinload(Moment.blocks),
        ]

    project = (
        await db.execute(
            select(Project).where(Project.id == project_id).options(*opciones)
        )
    ).scalar_one_or_none()
    if project is None:
        raise NotFound("Proyecto no encontrado")
    return project


async def _slug_libre(
    db: AsyncSession, slug: str, *, excepto: uuid.UUID | None = None
) -> None:
    stmt = select(Project.id).where(Project.slug == slug)
    if excepto:
        stmt = stmt.where(Project.id != excepto)
    if (await db.execute(stmt)).scalar_one_or_none():
        # El slug es unico en base de datos: sin esto saldria un IntegrityError
        # crudo en vez de un error de negocio que el frontend sepa pintar.
        raise Conflict(f"Ya existe un proyecto con el slug '{slug}'")


def _serializar(project: Project, lang: str) -> dict[str, Any]:
    tr = next((t for t in project.translations if t.lang == lang), None)
    return {
        "id": str(project.id),
        "slug": project.slug,
        "grade": project.grade,
        "kit": project.kit,
        "order": project.order,
        "status": project.status,
        "lang": lang,
        "title": tr.title if tr else None,
        "summary": tr.summary if tr else None,
        # Que idiomas tienen ya traduccion: el editor pinta con esto el
        # indicador de "falta traducir" (S4).
        "langs": sorted(t.lang for t in project.translations),
    }


def _serializar_momentos(project: Project, lang: str) -> list[dict[str, Any]]:
    """Los seis, siempre, en orden. Un momento sin traducir sale con title None:
    es lo que el editor tiene que rellenar, no un error."""
    return [
        {
            "id": str(m.id),
            "type": m.type,
            "order": m.order,
            "title": next(
                (t.title for t in m.translations if t.lang == lang), None
            ),
            "blocks": len(m.blocks),
            "langs": sorted(t.lang for t in m.translations),
        }
        for m in sorted(project.moments, key=lambda m: m.order)
    ]


def _upsert_traduccion(
    project: Project, *, lang: str, title: str | None, summary: str | None
) -> None:
    tr = next((t for t in project.translations if t.lang == lang), None)
    if tr is None:
        if title is None:
            return
        project.translations.append(
            ProjectTranslation(lang=lang, title=title, summary=summary)
        )
        return
    if title is not None:
        tr.title = title
    if summary is not None:
        tr.summary = summary


async def list_projects(
    db: AsyncSession, *, lang: str = "es", grade: str | None = None
) -> list[dict[str, Any]]:
    """Todos los proyectos, incluidos los borradores.

    A diferencia de `learning.list_published_projects`, que solo ve publicados.
    """
    stmt = (
        select(Project)
        .options(selectinload(Project.translations))
        .order_by(Project.order, Project.slug)
    )
    if grade:
        stmt = stmt.where(Project.grade == grade)

    rows = (await db.execute(stmt)).scalars().all()
    return [_serializar(p, lang) for p in rows]


async def get_project(
    db: AsyncSession, project_id: uuid.UUID, *, lang: str = "es"
) -> dict[str, Any]:
    """El detalle SI trae los momentos: es lo que pinta el editor.

    El listado no, que serian seis joins por fila para nada.
    """
    project = await _get(db, project_id, con_momentos=True)
    return {**_serializar(project, lang), "moments": _serializar_momentos(project, lang)}


async def create_project(
    db: AsyncSession,
    *,
    slug: str,
    grade: str,
    title: str,
    kit: str | None = None,
    order: int = 0,
    summary: str | None = None,
    lang: str = "es",
) -> dict[str, Any]:
    await _slug_libre(db, slug)

    project = Project(slug=slug, grade=grade, kit=kit, order=order)
    project.translations.append(
        ProjectTranslation(lang=lang, title=title, summary=summary)
    )
    # R7: los seis momentos metodologicos son fijos y en orden. Se crean con el
    # proyecto para que el editor los RELLENE, no para que los invente: si
    # pudiera anadirlos a mano acabaria habiendo proyectos con cinco, o con el
    # orden cambiado, y el estudiante veria recorridos distintos por proyecto.
    for orden, tipo in enumerate(MOMENT_ORDER):
        project.moments.append(Moment(type=tipo, order=orden))

    db.add(project)
    await db.flush()

    # Se relee por el camino del detalle en vez de serializar los objetos
    # recien creados: sus relaciones no estan cargadas y tocarlas dispara un
    # lazy load (MissingGreenlet en async). Ademas garantiza que crear y
    # consultar devuelvan exactamente la misma forma.
    return await get_project(db, project.id, lang=lang)


async def update_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    *,
    lang: str = "es",
    **campos: Any,
) -> dict[str, Any]:
    """Actualizacion parcial. Sólo toca lo que venga en `campos`.

    `status` NO se toca aqui a proposito: pasar de borrador a publicado es
    trabajo de `publishing`, que ademas versiona y dispara el reindexado.
    """
    project = await _get(db, project_id)

    if (slug := campos.get("slug")) is not None and slug != project.slug:
        await _slug_libre(db, slug, excepto=project.id)
        project.slug = slug

    for campo in ("grade", "kit", "order"):
        if (valor := campos.get(campo)) is not None:
            setattr(project, campo, valor)

    _upsert_traduccion(
        project,
        lang=lang,
        title=campos.get("title"),
        summary=campos.get("summary"),
    )

    await db.flush()
    await db.refresh(project, ["translations"])
    return _serializar(project, lang)


async def delete_project(db: AsyncSession, project_id: uuid.UUID) -> None:
    """Sólo borradores.

    `project_versions` cuelga con ON DELETE CASCADE, asi que borrar un proyecto
    publicado se llevaria por delante el snapshot del que se sirven los
    estudiantes, en mitad del semestre y sin aviso.
    """
    project = await _get(db, project_id)
    if project.status == ProjectStatus.PUBLISHED:
        raise Conflict(
            "No se puede borrar un proyecto publicado. Despublicalo primero."
        )
    await db.delete(project)
    await db.flush()


# --- Bloques de contenido -------------------------------------------------
#
# El bloque es la unidad que el editor mueve y que el RAG indexa. Su cuerpo
# vive en `BlockTranslation`, no en el bloque: el mismo bloque es el mismo
# trozo de contenido en los dos idiomas, y reordenar en español no puede
# desordenar el ingles.


def _serializar_bloque(bloque: ContentBlock, lang: str) -> dict[str, Any]:
    tr = next((t for t in bloque.translations if t.lang == lang), None)
    return {
        "id": str(bloque.id),
        "moment_id": str(bloque.moment_id),
        "kind": bloque.kind,
        "order": bloque.order,
        "media_asset_id": str(bloque.media_asset_id) if bloque.media_asset_id else None,
        "lang": lang,
        "body": tr.body if tr else None,
        "caption": tr.caption if tr else None,
        "alt_text": tr.alt_text if tr else None,
        "langs": sorted(t.lang for t in bloque.translations),
    }


async def _get_moment(db: AsyncSession, moment_id: uuid.UUID) -> Moment:
    moment = (
        await db.execute(
            select(Moment)
            .where(Moment.id == moment_id)
            .options(
                selectinload(Moment.translations),
                selectinload(Moment.blocks).selectinload(ContentBlock.translations),
            )
            # Sin populate_existing, si el momento ya esta en el identity map
            # con su coleccion cargada, SQLAlchemy devuelve LA VIEJA: anadir un
            # bloque y volver a listar no lo mostraba.
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if moment is None:
        raise NotFound("Momento no encontrado")
    return moment


async def _get_block(db: AsyncSession, block_id: uuid.UUID) -> ContentBlock:
    bloque = (
        await db.execute(
            select(ContentBlock)
            .where(ContentBlock.id == block_id)
            .options(selectinload(ContentBlock.translations))
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if bloque is None:
        raise NotFound("Bloque no encontrado")
    return bloque


async def _comprobar_media(db: AsyncSession, asset_id: uuid.UUID | None) -> None:
    """Sin esto, un id inexistente sale como IntegrityError -> 500."""
    if asset_id is not None and not await media.asset_existe(db, asset_id):
        raise ValidationFailed(f"El asset de media '{asset_id}' no existe")


async def list_blocks(
    db: AsyncSession, moment_id: uuid.UUID, *, lang: str = "es"
) -> list[dict[str, Any]]:
    moment = await _get_moment(db, moment_id)
    return [
        _serializar_bloque(b, lang)
        for b in sorted(moment.blocks, key=lambda b: b.order)
    ]


async def create_block(
    db: AsyncSession,
    moment_id: uuid.UUID,
    *,
    kind: str,
    lang: str = "es",
    media_asset_id: uuid.UUID | None = None,
    body: str | None = None,
    caption: str | None = None,
    alt_text: str | None = None,
) -> dict[str, Any]:
    """Se añade al final. El orden se cambia con `reorder_blocks`."""
    moment = await _get_moment(db, moment_id)
    await _comprobar_media(db, media_asset_id)

    siguiente = max((b.order for b in moment.blocks), default=-1) + 1
    bloque = ContentBlock(
        moment_id=moment.id,
        kind=kind,
        order=siguiente,
        media_asset_id=media_asset_id,
    )
    db.add(bloque)
    await db.flush()

    if any(v is not None for v in (body, caption, alt_text)):
        db.add(
            BlockTranslation(
                block_id=bloque.id,
                lang=lang,
                body=body,
                caption=caption,
                alt_text=alt_text,
            )
        )
        await db.flush()

    return _serializar_bloque(await _get_block(db, bloque.id), lang)


async def update_block(
    db: AsyncSession, block_id: uuid.UUID, *, lang: str = "es", **campos: Any
) -> dict[str, Any]:
    """Parcial. `order` no se toca aquí: se reordena en bloque, no de uno en uno."""
    bloque = await _get_block(db, block_id)

    if "kind" in campos and campos["kind"] is not None:
        bloque.kind = campos["kind"]
    if "media_asset_id" in campos:
        await _comprobar_media(db, campos["media_asset_id"])
        bloque.media_asset_id = campos["media_asset_id"]

    textos = {c: campos[c] for c in ("body", "caption", "alt_text") if c in campos}
    if textos:
        tr = next((t for t in bloque.translations if t.lang == lang), None)
        if tr is None:
            bloque.translations.append(BlockTranslation(lang=lang, **textos))
        else:
            for campo, valor in textos.items():
                setattr(tr, campo, valor)

    await db.flush()
    return _serializar_bloque(await _get_block(db, block_id), lang)


async def delete_block(db: AsyncSession, block_id: uuid.UUID) -> None:
    bloque = await _get_block(db, block_id)
    await db.delete(bloque)
    await db.flush()


async def reorder_blocks(
    db: AsyncSession, moment_id: uuid.UUID, block_ids: list[uuid.UUID]
) -> list[dict[str, Any]]:
    """Recibe el orden COMPLETO, no un movimiento.

    Es lo que manda un drag & drop y evita el estado intermedio inconsistente
    de ir subiendo bloques de uno en uno con peticiones sueltas.
    """
    moment = await _get_moment(db, moment_id)
    actuales = {b.id for b in moment.blocks}

    if set(block_ids) != actuales or len(block_ids) != len(actuales):
        raise ValidationFailed(
            "El reordenamiento debe incluir exactamente los bloques del momento, "
            "una sola vez cada uno"
        )

    por_id = {b.id: b for b in moment.blocks}
    for posicion, bid in enumerate(block_ids):
        por_id[bid].order = posicion

    await db.flush()
    return await list_blocks(db, moment_id)


# --- Momentos -------------------------------------------------------------
#
# No hay create ni delete a proposito: son seis, fijos, y los crea el proyecto
# (R7). Aqui solo se RELLENAN.


def _serializar_momento(moment: Moment, lang: str) -> dict[str, Any]:
    tr = next((t for t in moment.translations if t.lang == lang), None)
    return {
        "id": str(moment.id),
        "project_id": str(moment.project_id),
        "type": moment.type,
        "order": moment.order,
        "lang": lang,
        "title": tr.title if tr else None,
        # R4: la guia docente vive aqui y NO se filtra en el Studio — quien
        # entra es editor o admin. El filtro por rol es del camino de lectura.
        "teacher_note": tr.teacher_note if tr else None,
        # R8: la pregunta con la que el chat abre el momento.
        "chatbot_opening_prompt": tr.chatbot_opening_prompt if tr else None,
        "langs": sorted(t.lang for t in moment.translations),
        "blocks": [
            _serializar_bloque(b, lang)
            for b in sorted(moment.blocks, key=lambda b: b.order)
        ],
    }


async def get_moment(
    db: AsyncSession, moment_id: uuid.UUID, *, lang: str = "es"
) -> dict[str, Any]:
    return _serializar_momento(await _get_moment(db, moment_id), lang)


async def update_moment(
    db: AsyncSession, moment_id: uuid.UUID, *, lang: str = "es", **campos: Any
) -> dict[str, Any]:
    """Parcial, por idioma. `type` y `order` no se tocan: los fija R7."""
    moment = await _get_moment(db, moment_id)

    textos = {
        c: campos[c]
        for c in ("title", "teacher_note", "chatbot_opening_prompt")
        if c in campos
    }
    if textos:
        tr = next((t for t in moment.translations if t.lang == lang), None)
        if tr is None:
            # `title` es NOT NULL: guardar solo la guia docente sin haber
            # puesto titulo reventaba con un IntegrityError. Se crea vacio y
            # la validacion de publicacion es la que exige que se rellene.
            textos.setdefault("title", "")
            moment.translations.append(MomentTranslation(lang=lang, **textos))
        else:
            for campo, valor in textos.items():
                setattr(tr, campo, valor)
        await db.flush()

    return _serializar_momento(await _get_moment(db, moment_id), lang)


async def estado_de_traduccion(
    db: AsyncSession, project_id: uuid.UUID
) -> list[dict[str, Any]]:
    """Que le falta al proyecto para poder servirse en cada idioma.

    Reutiliza la validacion de `publishing`: el editor tiene que ver
    exactamente el mismo criterio que decide si un idioma entra al snapshot.
    Un booleano "traducido si/no" no sirve — hay que decir QUE falta.
    """
    from app.modules.publishing import service as publishing

    project = await publishing.cargar_para_validar(db, project_id)
    return [
        {
            "lang": lang,
            "complete": not (faltan := publishing.problemas_de_idioma(project, lang)),
            "missing": faltan,
        }
        for lang in publishing.LANGS
    ]


async def uso_de_assets(
    db: AsyncSession, asset_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    """Cuantos bloques referencian cada asset.

    Vive aqui porque `ContentBlock` es de catalog; `media` la llama para saber
    si puede borrar. La alternativa era que media importase el modelo ajeno.
    """
    if not asset_ids:
        return {}

    filas = await db.execute(
        select(ContentBlock.media_asset_id, func.count(ContentBlock.id))
        .where(ContentBlock.media_asset_id.in_(asset_ids))
        .group_by(ContentBlock.media_asset_id)
    )
    return dict(filas.all())

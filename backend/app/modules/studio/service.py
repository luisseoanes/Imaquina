"""Autoría de los dominios propios del Studio.

Mismo criterio que `catalog`: camino de ESCRITURA, contra tablas normalizadas.
Validación al publicar, no al escribir — un borrador a medias se guarda sin
protestar. Lo único que se exige aquí es lo que rompería la base (slug único,
referencias existentes).
"""

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import Conflict, NotFound, ValidationFailed
from app.modules.studio.models import (
    Collection,
    CollectionItem,
    CollectionTranslation,
    ContentStatus,
    ContentTag,
    ContentTemplate,
    LearningPath,
    LearningPathItem,
    LearningPathTranslation,
    Lesson,
    LessonTranslation,
    RefType,
    Resource,
    ResourceTranslation,
    Tag,
)

LANGS = ("es", "en")


# --- Utilidades compartidas ---------------------------------------------


async def _slug_libre(
    db: AsyncSession, modelo: type, slug: str, *, excepto: uuid.UUID | None = None
) -> None:
    stmt = select(modelo.id).where(modelo.slug == slug)
    if excepto:
        stmt = stmt.where(modelo.id != excepto)
    if (await db.execute(stmt)).scalar_one_or_none():
        raise Conflict(f"Ya existe un elemento con el slug '{slug}'")


def _tr(translations: list, lang: str):
    return next((t for t in translations if t.lang == lang), None)


def _langs(translations: list) -> list[str]:
    return sorted(t.lang for t in translations)


def _upsert_tr(
    coleccion: list, factory, lang: str, campos: dict[str, Any]
) -> None:
    """Crea o actualiza la traducción del idioma pedido.

    `campos` ya viene filtrado a lo que trajo el PATCH. Si no hay traducción y
    tampoco `title`, no se crea nada (title es NOT NULL en todas las tablas).
    """
    tr = _tr(coleccion, lang)
    if tr is None:
        if "title" not in campos:
            campos = {**campos, "title": ""}
        coleccion.append(factory(lang=lang, **campos))
    else:
        for k, v in campos.items():
            setattr(tr, k, v)


# --- Lecciones ---------------------------------------------------------------


def _ser_lesson(x: Lesson, lang: str) -> dict[str, Any]:
    tr = _tr(x.translations, lang)
    return {
        "id": str(x.id),
        "slug": x.slug,
        "area": x.area,
        "grade": x.grade,
        "status": x.status,
        "estimated_minutes": x.estimated_minutes,
        "lang": lang,
        "title": tr.title if tr else None,
        "summary": tr.summary if tr else None,
        "body": tr.body if tr else None,
        "langs": _langs(x.translations),
        "updated_at": x.updated_at.isoformat(),
    }


async def _get_lesson(db: AsyncSession, lesson_id: uuid.UUID) -> Lesson:
    x = (
        await db.execute(
            select(Lesson)
            .where(Lesson.id == lesson_id)
            .options(selectinload(Lesson.translations))
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if x is None:
        raise NotFound("Lección no encontrada")
    return x


async def list_lessons(
    db: AsyncSession, *, lang: str = "es", area: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    stmt = (
        select(Lesson)
        .options(selectinload(Lesson.translations))
        .order_by(Lesson.updated_at.desc())
    )
    if area:
        stmt = stmt.where(Lesson.area == area)
    if status:
        stmt = stmt.where(Lesson.status == status)
    rows = (await db.execute(stmt)).scalars().all()
    return [_ser_lesson(x, lang) for x in rows]


async def create_lesson(
    db: AsyncSession, *, slug: str, area: str, title: str, lang: str = "es",
    grade: str | None = None, summary: str | None = None, body: str | None = None,
    estimated_minutes: int | None = None,
) -> dict[str, Any]:
    await _slug_libre(db, Lesson, slug)
    x = Lesson(slug=slug, area=area, grade=grade, estimated_minutes=estimated_minutes)
    x.translations.append(
        LessonTranslation(lang=lang, title=title, summary=summary, body=body)
    )
    db.add(x)
    await db.flush()
    return _ser_lesson(await _get_lesson(db, x.id), lang)


async def update_lesson(
    db: AsyncSession, lesson_id: uuid.UUID, *, lang: str = "es", **campos: Any
) -> dict[str, Any]:
    x = await _get_lesson(db, lesson_id)
    if (slug := campos.pop("slug", None)) is not None and slug != x.slug:
        await _slug_libre(db, Lesson, slug, excepto=x.id)
        x.slug = slug
    for c in ("area", "grade", "estimated_minutes"):
        if c in campos:
            setattr(x, c, campos.pop(c))
    textos = {c: campos[c] for c in ("title", "summary", "body") if c in campos}
    if textos:
        _upsert_tr(x.translations, LessonTranslation, lang, textos)
    await db.flush()
    return _ser_lesson(await _get_lesson(db, lesson_id), lang)


async def set_lesson_status(
    db: AsyncSession, lesson_id: uuid.UUID, *, status: str
) -> dict[str, Any]:
    if status not in tuple(ContentStatus):
        raise ValidationFailed(f"Estado inválido: {status}")
    x = await _get_lesson(db, lesson_id)
    if status == ContentStatus.PUBLISHED and not _tr(x.translations, "es"):
        raise ValidationFailed("Falta la traducción en español para publicar")
    x.status = status
    await db.flush()
    return _ser_lesson(await _get_lesson(db, lesson_id), "es")


async def delete_lesson(db: AsyncSession, lesson_id: uuid.UUID) -> None:
    x = await _get_lesson(db, lesson_id)
    if x.status == ContentStatus.PUBLISHED:
        raise Conflict("Despublica la lección antes de borrarla")
    await db.delete(x)
    await db.flush()


# --- Recursos --------------------------------------------------------------


def _ser_resource(x: Resource, lang: str) -> dict[str, Any]:
    tr = _tr(x.translations, lang)
    return {
        "id": str(x.id),
        "slug": x.slug,
        "area": x.area,
        "kind": x.kind,
        "status": x.status,
        "url": x.url,
        "media_asset_id": str(x.media_asset_id) if x.media_asset_id else None,
        "lang": lang,
        "title": tr.title if tr else None,
        "description": tr.description if tr else None,
        "langs": _langs(x.translations),
        "updated_at": x.updated_at.isoformat(),
    }


async def _get_resource(db: AsyncSession, resource_id: uuid.UUID) -> Resource:
    x = (
        await db.execute(
            select(Resource)
            .where(Resource.id == resource_id)
            .options(selectinload(Resource.translations))
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if x is None:
        raise NotFound("Recurso no encontrado")
    return x


async def _check_media(db: AsyncSession, asset_id: uuid.UUID | None) -> None:
    if asset_id is None:
        return
    from app.modules.media import service as media

    if not await media.asset_existe(db, asset_id):
        raise ValidationFailed(f"El asset de media '{asset_id}' no existe")


async def list_resources(
    db: AsyncSession, *, lang: str = "es", area: str | None = None,
    kind: str | None = None, status: str | None = None,
) -> list[dict[str, Any]]:
    stmt = (
        select(Resource)
        .options(selectinload(Resource.translations))
        .order_by(Resource.updated_at.desc())
    )
    if area:
        stmt = stmt.where(Resource.area == area)
    if kind:
        stmt = stmt.where(Resource.kind == kind)
    if status:
        stmt = stmt.where(Resource.status == status)
    rows = (await db.execute(stmt)).scalars().all()
    return [_ser_resource(x, lang) for x in rows]


async def create_resource(
    db: AsyncSession, *, slug: str, area: str, title: str, lang: str = "es",
    kind: str = "link", url: str | None = None, description: str | None = None,
    media_asset_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    await _slug_libre(db, Resource, slug)
    await _check_media(db, media_asset_id)
    x = Resource(slug=slug, area=area, kind=kind, url=url, media_asset_id=media_asset_id)
    x.translations.append(
        ResourceTranslation(lang=lang, title=title, description=description)
    )
    db.add(x)
    await db.flush()
    return _ser_resource(await _get_resource(db, x.id), lang)


async def update_resource(
    db: AsyncSession, resource_id: uuid.UUID, *, lang: str = "es", **campos: Any
) -> dict[str, Any]:
    x = await _get_resource(db, resource_id)
    if (slug := campos.pop("slug", None)) is not None and slug != x.slug:
        await _slug_libre(db, Resource, slug, excepto=x.id)
        x.slug = slug
    if "media_asset_id" in campos:
        await _check_media(db, campos["media_asset_id"])
    for c in ("area", "kind", "url", "media_asset_id"):
        if c in campos:
            setattr(x, c, campos.pop(c))
    textos = {c: campos[c] for c in ("title", "description") if c in campos}
    if textos:
        _upsert_tr(x.translations, ResourceTranslation, lang, textos)
    await db.flush()
    return _ser_resource(await _get_resource(db, resource_id), lang)


async def set_resource_status(
    db: AsyncSession, resource_id: uuid.UUID, *, status: str
) -> dict[str, Any]:
    if status not in tuple(ContentStatus):
        raise ValidationFailed(f"Estado inválido: {status}")
    x = await _get_resource(db, resource_id)
    x.status = status
    await db.flush()
    return _ser_resource(await _get_resource(db, resource_id), "es")


async def delete_resource(db: AsyncSession, resource_id: uuid.UUID) -> None:
    x = await _get_resource(db, resource_id)
    await db.delete(x)
    await db.flush()


# --- Rutas de aprendizaje -------------------------------------------------

_REF_MODELS: dict[str, Any] = {}


def _ref_models() -> dict[str, Any]:
    """Carga diferida: importar `catalog`/`assessment` a nivel de módulo cruza
    con sus imports de `media`/`publishing` y da circular."""
    if not _REF_MODELS:
        from app.modules.assessment.models import Assessment
        from app.modules.catalog.models import Project

        _REF_MODELS.update(
            {
                RefType.PROJECT: Project,
                RefType.LESSON: Lesson,
                RefType.RESOURCE: Resource,
                RefType.ASSESSMENT: Assessment,
            }
        )
    return _REF_MODELS


async def _check_ref(db: AsyncSession, ref_type: str, ref_id: uuid.UUID) -> None:
    if ref_type not in tuple(RefType):
        raise ValidationFailed(f"Tipo de referencia inválido: {ref_type}")
    modelo = _ref_models()[ref_type]
    if (
        await db.execute(select(modelo.id).where(modelo.id == ref_id))
    ).scalar_one_or_none() is None:
        raise ValidationFailed(f"No existe {ref_type} con id {ref_id}")


def _ser_path(x: LearningPath, lang: str) -> dict[str, Any]:
    tr = _tr(x.translations, lang)
    return {
        "id": str(x.id),
        "slug": x.slug,
        "grade": x.grade,
        "status": x.status,
        "lang": lang,
        "title": tr.title if tr else None,
        "description": tr.description if tr else None,
        "langs": _langs(x.translations),
        "items": [
            {
                "id": str(it.id),
                "order": it.order,
                "ref_type": it.ref_type,
                "ref_id": str(it.ref_id),
            }
            for it in sorted(x.items, key=lambda i: i.order)
        ],
        "updated_at": x.updated_at.isoformat(),
    }


async def _get_path(db: AsyncSession, path_id: uuid.UUID) -> LearningPath:
    x = (
        await db.execute(
            select(LearningPath)
            .where(LearningPath.id == path_id)
            .options(
                selectinload(LearningPath.translations),
                selectinload(LearningPath.items),
            )
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if x is None:
        raise NotFound("Ruta no encontrada")
    return x


async def list_paths(
    db: AsyncSession, *, lang: str = "es", grade: str | None = None
) -> list[dict[str, Any]]:
    stmt = (
        select(LearningPath)
        .options(
            selectinload(LearningPath.translations),
            selectinload(LearningPath.items),
        )
        .order_by(LearningPath.updated_at.desc())
    )
    if grade:
        stmt = stmt.where(LearningPath.grade == grade)
    rows = (await db.execute(stmt)).scalars().all()
    return [_ser_path(x, lang) for x in rows]


async def get_path(
    db: AsyncSession, path_id: uuid.UUID, *, lang: str = "es"
) -> dict[str, Any]:
    return _ser_path(await _get_path(db, path_id), lang)


async def create_path(
    db: AsyncSession, *, slug: str, title: str, lang: str = "es",
    grade: str | None = None, description: str | None = None,
) -> dict[str, Any]:
    await _slug_libre(db, LearningPath, slug)
    x = LearningPath(slug=slug, grade=grade)
    x.translations.append(
        LearningPathTranslation(lang=lang, title=title, description=description)
    )
    db.add(x)
    await db.flush()
    return _ser_path(await _get_path(db, x.id), lang)


async def update_path(
    db: AsyncSession, path_id: uuid.UUID, *, lang: str = "es", **campos: Any
) -> dict[str, Any]:
    x = await _get_path(db, path_id)
    if (slug := campos.pop("slug", None)) is not None and slug != x.slug:
        await _slug_libre(db, LearningPath, slug, excepto=x.id)
        x.slug = slug
    if "grade" in campos:
        x.grade = campos.pop("grade")
    if "status" in campos:
        st = campos.pop("status")
        if st not in tuple(ContentStatus):
            raise ValidationFailed(f"Estado inválido: {st}")
        x.status = st
    textos = {c: campos[c] for c in ("title", "description") if c in campos}
    if textos:
        _upsert_tr(x.translations, LearningPathTranslation, lang, textos)
    await db.flush()
    return _ser_path(await _get_path(db, path_id), lang)


async def delete_path(db: AsyncSession, path_id: uuid.UUID) -> None:
    await db.delete(await _get_path(db, path_id))
    await db.flush()


async def set_path_items(
    db: AsyncSession, path_id: uuid.UUID, entradas: list[dict[str, Any]]
) -> dict[str, Any]:
    """Reemplaza la lista entera: es lo que manda un editor de secuencia con
    drag & drop, no un alta suelta."""
    x = await _get_path(db, path_id)
    for e in entradas:
        await _check_ref(db, e["ref_type"], uuid.UUID(str(e["ref_id"])))
    x.items.clear()
    await db.flush()
    for i, e in enumerate(entradas):
        x.items.append(
            LearningPathItem(
                order=i,
                ref_type=e["ref_type"],
                ref_id=uuid.UUID(str(e["ref_id"])),
            )
        )
    await db.flush()
    return _ser_path(await _get_path(db, path_id), "es")


# --- Plantillas ----------------------------------------------------------


def _ser_template(x: ContentTemplate) -> dict[str, Any]:
    return {
        "id": str(x.id),
        "slug": x.slug,
        "kind": x.kind,
        "name": x.name,
        "description": x.description,
        "payload": x.payload,
        "created_by": str(x.created_by) if x.created_by else None,
        "updated_at": x.updated_at.isoformat(),
    }


async def _get_template(db: AsyncSession, template_id: uuid.UUID) -> ContentTemplate:
    x = (
        await db.execute(
            select(ContentTemplate).where(ContentTemplate.id == template_id)
        )
    ).scalar_one_or_none()
    if x is None:
        raise NotFound("Plantilla no encontrada")
    return x


async def list_templates(
    db: AsyncSession, *, kind: str | None = None
) -> list[dict[str, Any]]:
    stmt = select(ContentTemplate).order_by(ContentTemplate.updated_at.desc())
    if kind:
        stmt = stmt.where(ContentTemplate.kind == kind)
    return [_ser_template(x) for x in (await db.execute(stmt)).scalars().all()]


async def create_template(
    db: AsyncSession, *, slug: str, name: str, kind: str = "project",
    description: str | None = None, payload: dict | None = None,
    created_by: uuid.UUID | None = None,
) -> dict[str, Any]:
    await _slug_libre(db, ContentTemplate, slug)
    x = ContentTemplate(
        slug=slug, name=name, kind=kind, description=description,
        payload=payload or {}, created_by=created_by,
    )
    db.add(x)
    await db.flush()
    return _ser_template(await _get_template(db, x.id))


async def update_template(
    db: AsyncSession, template_id: uuid.UUID, **campos: Any
) -> dict[str, Any]:
    x = await _get_template(db, template_id)
    if (slug := campos.pop("slug", None)) is not None and slug != x.slug:
        await _slug_libre(db, ContentTemplate, slug, excepto=x.id)
        x.slug = slug
    for c in ("name", "kind", "description", "payload"):
        if c in campos and campos[c] is not None:
            setattr(x, c, campos[c])
    await db.flush()
    return _ser_template(await _get_template(db, template_id))


async def delete_template(db: AsyncSession, template_id: uuid.UUID) -> None:
    await db.delete(await _get_template(db, template_id))
    await db.flush()


async def apply_project_template(
    db: AsyncSession, template_id: uuid.UUID, *, slug: str, grade: str
) -> dict[str, Any]:
    """Instancia una plantilla de proyecto.

    El `payload` esperado: `{"title": str, "summary": str|None,
    "moments": {<type>: {"title": str, "blocks": [{"kind": str, "body": str}]}}}`.
    Se apoya en `catalog` para crear (los 6 momentos ya nacen con el proyecto)
    y luego rellena títulos y bloques.
    """
    x = await _get_template(db, template_id)
    if x.kind != "project":
        raise ValidationFailed("La plantilla no es de tipo proyecto")

    from app.modules.catalog import service as catalog

    payload = x.payload or {}
    proyecto = await catalog.create_project(
        db,
        slug=slug,
        grade=grade,
        title=payload.get("title") or x.name,
        summary=payload.get("summary"),
    )
    momentos = {m["type"]: m["id"] for m in proyecto["moments"]}
    for tipo, datos in (payload.get("moments") or {}).items():
        mid = momentos.get(tipo)
        if mid is None:
            continue
        if datos.get("title"):
            await catalog.update_moment(
                db, uuid.UUID(mid), title=datos["title"]
            )
        for bloque in datos.get("blocks", []):
            await catalog.create_block(
                db,
                uuid.UUID(mid),
                kind=bloque.get("kind", "text"),
                body=bloque.get("body"),
            )
    return proyecto


# --- Etiquetas ---------------------------------------------------------------


def _ser_tag(x: Tag, usos: int = 0) -> dict[str, Any]:
    return {
        "id": str(x.id),
        "slug": x.slug,
        "name": x.name,
        "color": x.color,
        "used_in": usos,
    }


async def _get_tag(db: AsyncSession, tag_id: uuid.UUID) -> Tag:
    x = (
        await db.execute(select(Tag).where(Tag.id == tag_id))
    ).scalar_one_or_none()
    if x is None:
        raise NotFound("Etiqueta no encontrada")
    return x


async def list_tags(db: AsyncSession) -> list[dict[str, Any]]:
    rows = (
        await db.execute(select(Tag).order_by(Tag.name))
    ).scalars().all()
    usos = dict(
        (
            await db.execute(
                select(ContentTag.tag_id, func.count(ContentTag.id)).group_by(
                    ContentTag.tag_id
                )
            )
        ).all()
    )
    return [_ser_tag(x, usos.get(x.id, 0)) for x in rows]


async def create_tag(
    db: AsyncSession, *, slug: str, name: str, color: str | None = None
) -> dict[str, Any]:
    await _slug_libre(db, Tag, slug)
    x = Tag(slug=slug, name=name, color=color)
    db.add(x)
    await db.flush()
    return _ser_tag(x)


async def update_tag(
    db: AsyncSession, tag_id: uuid.UUID, **campos: Any
) -> dict[str, Any]:
    x = await _get_tag(db, tag_id)
    if (slug := campos.pop("slug", None)) is not None and slug != x.slug:
        await _slug_libre(db, Tag, slug, excepto=x.id)
        x.slug = slug
    for c in ("name", "color"):
        if c in campos:
            setattr(x, c, campos[c])
    await db.flush()
    return _ser_tag(x)


async def delete_tag(db: AsyncSession, tag_id: uuid.UUID) -> None:
    await db.delete(await _get_tag(db, tag_id))
    await db.flush()


async def set_tags_for(
    db: AsyncSession, target_type: str, target_id: uuid.UUID, tag_ids: list[uuid.UUID]
) -> list[str]:
    """Reemplaza las etiquetas de un contenido concreto."""
    if target_type not in tuple(RefType):
        raise ValidationFailed(f"Tipo inválido: {target_type}")
    actuales = (
        await db.execute(
            select(ContentTag).where(
                ContentTag.target_type == target_type,
                ContentTag.target_id == target_id,
            )
        )
    ).scalars().all()
    for ct in actuales:
        await db.delete(ct)
    await db.flush()
    for tid in tag_ids:
        await _get_tag(db, tid)
        db.add(
            ContentTag(tag_id=tid, target_type=target_type, target_id=target_id)
        )
    await db.flush()
    return [str(t) for t in tag_ids]


async def tags_of(
    db: AsyncSession, target_type: str, target_id: uuid.UUID
) -> list[dict[str, Any]]:
    rows = (
        await db.execute(
            select(Tag)
            .join(ContentTag, ContentTag.tag_id == Tag.id)
            .where(
                ContentTag.target_type == target_type,
                ContentTag.target_id == target_id,
            )
            .order_by(Tag.name)
        )
    ).scalars().all()
    return [_ser_tag(x) for x in rows]


# --- Colecciones -------------------------------------------------------------


def _ser_collection(x: Collection, lang: str) -> dict[str, Any]:
    tr = _tr(x.translations, lang)
    return {
        "id": str(x.id),
        "slug": x.slug,
        "lang": lang,
        "title": tr.title if tr else None,
        "description": tr.description if tr else None,
        "langs": _langs(x.translations),
        "items": [
            {
                "id": str(it.id),
                "order": it.order,
                "target_type": it.target_type,
                "target_id": str(it.target_id),
            }
            for it in sorted(x.items, key=lambda i: i.order)
        ],
        "updated_at": x.updated_at.isoformat(),
    }


async def _get_collection(db: AsyncSession, collection_id: uuid.UUID) -> Collection:
    x = (
        await db.execute(
            select(Collection)
            .where(Collection.id == collection_id)
            .options(
                selectinload(Collection.translations),
                selectinload(Collection.items),
            )
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if x is None:
        raise NotFound("Colección no encontrada")
    return x


async def list_collections(
    db: AsyncSession, *, lang: str = "es"
) -> list[dict[str, Any]]:
    rows = (
        await db.execute(
            select(Collection)
            .options(
                selectinload(Collection.translations),
                selectinload(Collection.items),
            )
            .order_by(Collection.updated_at.desc())
        )
    ).scalars().all()
    return [_ser_collection(x, lang) for x in rows]


async def get_collection(
    db: AsyncSession, collection_id: uuid.UUID, *, lang: str = "es"
) -> dict[str, Any]:
    return _ser_collection(await _get_collection(db, collection_id), lang)


async def create_collection(
    db: AsyncSession, *, slug: str, title: str, lang: str = "es",
    description: str | None = None,
) -> dict[str, Any]:
    await _slug_libre(db, Collection, slug)
    x = Collection(slug=slug)
    x.translations.append(
        CollectionTranslation(lang=lang, title=title, description=description)
    )
    db.add(x)
    await db.flush()
    return _ser_collection(await _get_collection(db, x.id), lang)


async def update_collection(
    db: AsyncSession, collection_id: uuid.UUID, *, lang: str = "es", **campos: Any
) -> dict[str, Any]:
    x = await _get_collection(db, collection_id)
    if (slug := campos.pop("slug", None)) is not None and slug != x.slug:
        await _slug_libre(db, Collection, slug, excepto=x.id)
        x.slug = slug
    textos = {c: campos[c] for c in ("title", "description") if c in campos}
    if textos:
        _upsert_tr(x.translations, CollectionTranslation, lang, textos)
    await db.flush()
    return _ser_collection(await _get_collection(db, collection_id), lang)


async def delete_collection(db: AsyncSession, collection_id: uuid.UUID) -> None:
    await db.delete(await _get_collection(db, collection_id))
    await db.flush()


async def set_collection_items(
    db: AsyncSession, collection_id: uuid.UUID, entradas: list[dict[str, Any]]
) -> dict[str, Any]:
    x = await _get_collection(db, collection_id)
    for e in entradas:
        await _check_ref(db, e["target_type"], uuid.UUID(str(e["target_id"])))
    x.items.clear()
    await db.flush()
    for i, e in enumerate(entradas):
        x.items.append(
            CollectionItem(
                order=i,
                target_type=e["target_type"],
                target_id=uuid.UUID(str(e["target_id"])),
            )
        )
    await db.flush()
    return _ser_collection(await _get_collection(db, collection_id), "es")

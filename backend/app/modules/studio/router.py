"""Endpoints de los dominios propios del Content Studio.

Todo bajo `Author` (editor/admin): el panel del editor no lo pisa ni el
docente ni el estudiante. La autorización real vive aquí, no en el cliente.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.deps import Author, Db
from app.modules.studio import analytics, service

router = APIRouter(prefix="/studio", tags=["studio"])


# --- Tablero -----------------------------------------------------------------


@router.get("/dashboard")
async def get_dashboard(author: Author, db: Db):
    return await analytics.dashboard(db, author.require_institution())


@router.get("/analytics/assessments")
async def get_assessment_analytics(author: Author, db: Db):
    return await analytics.assessment_analytics(db, author.require_institution())


@router.get("/students")
async def get_students(author: Author, db: Db):
    return await analytics.student_activity(db, author.require_institution())


# --- Lecciones -------------------------------------------------------------


class LessonIn(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    area: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=300)
    grade: str | None = Field(default=None, max_length=20)
    summary: str | None = None
    body: str | None = None
    estimated_minutes: int | None = Field(default=None, ge=0)
    lang: str = Field(default="es", pattern="^(es|en)$")


class LessonPatch(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    area: str | None = Field(default=None, min_length=1, max_length=80)
    title: str | None = Field(default=None, max_length=300)
    grade: str | None = Field(default=None, max_length=20)
    summary: str | None = None
    body: str | None = None
    estimated_minutes: int | None = Field(default=None, ge=0)
    lang: str = Field(default="es", pattern="^(es|en)$")


class StatusIn(BaseModel):
    status: str = Field(pattern="^(draft|published)$")


@router.get("/lessons")
async def list_lessons(
    author: Author, db: Db, lang: str = "es",
    area: str | None = None, status: str | None = None,
):
    return await service.list_lessons(db, lang=lang, area=area, status=status)


@router.post("/lessons", status_code=201)
async def create_lesson(payload: LessonIn, author: Author, db: Db):
    return await service.create_lesson(db, **payload.model_dump())


@router.patch("/lessons/{lesson_id}")
async def update_lesson(lesson_id: UUID, payload: LessonPatch, author: Author, db: Db):
    datos = payload.model_dump(exclude_unset=True)
    lang = datos.pop("lang", "es")
    return await service.update_lesson(db, lesson_id, lang=lang, **datos)


@router.post("/lessons/{lesson_id}/status")
async def set_lesson_status(lesson_id: UUID, payload: StatusIn, author: Author, db: Db):
    return await service.set_lesson_status(db, lesson_id, status=payload.status)


@router.delete("/lessons/{lesson_id}", status_code=204)
async def delete_lesson(lesson_id: UUID, author: Author, db: Db) -> None:
    await service.delete_lesson(db, lesson_id)


# --- Recursos --------------------------------------------------------------


class ResourceIn(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    area: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=300)
    kind: str = Field(default="link", pattern="^(link|file|doc)$")
    url: str | None = Field(default=None, max_length=1000)
    description: str | None = None
    media_asset_id: UUID | None = None
    lang: str = Field(default="es", pattern="^(es|en)$")


class ResourcePatch(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    area: str | None = Field(default=None, min_length=1, max_length=80)
    title: str | None = Field(default=None, max_length=300)
    kind: str | None = Field(default=None, pattern="^(link|file|doc)$")
    url: str | None = Field(default=None, max_length=1000)
    description: str | None = None
    media_asset_id: UUID | None = None
    lang: str = Field(default="es", pattern="^(es|en)$")


@router.get("/resources")
async def list_resources(
    author: Author, db: Db, lang: str = "es",
    area: str | None = None, kind: str | None = None, status: str | None = None,
):
    return await service.list_resources(
        db, lang=lang, area=area, kind=kind, status=status
    )


@router.post("/resources", status_code=201)
async def create_resource(payload: ResourceIn, author: Author, db: Db):
    return await service.create_resource(db, **payload.model_dump())


@router.patch("/resources/{resource_id}")
async def update_resource(
    resource_id: UUID, payload: ResourcePatch, author: Author, db: Db
):
    datos = payload.model_dump(exclude_unset=True)
    lang = datos.pop("lang", "es")
    return await service.update_resource(db, resource_id, lang=lang, **datos)


@router.post("/resources/{resource_id}/status")
async def set_resource_status(
    resource_id: UUID, payload: StatusIn, author: Author, db: Db
):
    return await service.set_resource_status(db, resource_id, status=payload.status)


@router.delete("/resources/{resource_id}", status_code=204)
async def delete_resource(resource_id: UUID, author: Author, db: Db) -> None:
    await service.delete_resource(db, resource_id)


# --- Rutas de aprendizaje -------------------------------------------------


class PathIn(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=300)
    grade: str | None = Field(default=None, max_length=20)
    description: str | None = None
    lang: str = Field(default="es", pattern="^(es|en)$")


class PathPatch(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    title: str | None = Field(default=None, max_length=300)
    grade: str | None = Field(default=None, max_length=20)
    description: str | None = None
    status: str | None = Field(default=None, pattern="^(draft|published)$")
    lang: str = Field(default="es", pattern="^(es|en)$")


class PathItemIn(BaseModel):
    ref_type: str = Field(pattern="^(project|lesson|resource|assessment)$")
    ref_id: UUID


class PathItemsIn(BaseModel):
    items: list[PathItemIn]


@router.get("/paths")
async def list_paths(
    author: Author, db: Db, lang: str = "es", grade: str | None = None
):
    return await service.list_paths(db, lang=lang, grade=grade)


@router.get("/paths/{path_id}")
async def get_path(path_id: UUID, author: Author, db: Db, lang: str = "es"):
    return await service.get_path(db, path_id, lang=lang)


@router.post("/paths", status_code=201)
async def create_path(payload: PathIn, author: Author, db: Db):
    return await service.create_path(db, **payload.model_dump())


@router.patch("/paths/{path_id}")
async def update_path(path_id: UUID, payload: PathPatch, author: Author, db: Db):
    datos = payload.model_dump(exclude_unset=True)
    lang = datos.pop("lang", "es")
    return await service.update_path(db, path_id, lang=lang, **datos)


@router.put("/paths/{path_id}/items")
async def set_path_items(
    path_id: UUID, payload: PathItemsIn, author: Author, db: Db
):
    entradas = [
        {"ref_type": i.ref_type, "ref_id": str(i.ref_id)} for i in payload.items
    ]
    return await service.set_path_items(db, path_id, entradas)


@router.delete("/paths/{path_id}", status_code=204)
async def delete_path(path_id: UUID, author: Author, db: Db) -> None:
    await service.delete_path(db, path_id)


# --- Plantillas ----------------------------------------------------------


class TemplateIn(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=200)
    kind: str = Field(default="project", pattern="^(project|lesson)$")
    description: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class TemplatePatch(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    name: str | None = Field(default=None, max_length=200)
    kind: str | None = Field(default=None, pattern="^(project|lesson)$")
    description: str | None = None
    payload: dict[str, Any] | None = None


class ApplyTemplateIn(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    grade: str = Field(min_length=1, max_length=20)


@router.get("/templates")
async def list_templates(author: Author, db: Db, kind: str | None = None):
    return await service.list_templates(db, kind=kind)


@router.post("/templates", status_code=201)
async def create_template(payload: TemplateIn, author: Author, db: Db):
    return await service.create_template(
        db, created_by=author.user_id, **payload.model_dump()
    )


@router.patch("/templates/{template_id}")
async def update_template(
    template_id: UUID, payload: TemplatePatch, author: Author, db: Db
):
    return await service.update_template(
        db, template_id, **payload.model_dump(exclude_unset=True)
    )


@router.post("/templates/{template_id}/apply", status_code=201)
async def apply_template(
    template_id: UUID, payload: ApplyTemplateIn, author: Author, db: Db
):
    return await service.apply_project_template(
        db, template_id, slug=payload.slug, grade=payload.grade
    )


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(template_id: UUID, author: Author, db: Db) -> None:
    await service.delete_template(db, template_id)


# --- Etiquetas ---------------------------------------------------------------


class TagIn(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=80)
    color: str | None = Field(default=None, max_length=20)


class TagPatch(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=80)
    name: str | None = Field(default=None, max_length=80)
    color: str | None = Field(default=None, max_length=20)


class TagsForIn(BaseModel):
    target_type: str = Field(pattern="^(project|lesson|resource|assessment)$")
    target_id: UUID
    tag_ids: list[UUID]


@router.get("/tags")
async def list_tags(author: Author, db: Db):
    return await service.list_tags(db)


@router.post("/tags", status_code=201)
async def create_tag(payload: TagIn, author: Author, db: Db):
    return await service.create_tag(db, **payload.model_dump())


@router.patch("/tags/{tag_id}")
async def update_tag(tag_id: UUID, payload: TagPatch, author: Author, db: Db):
    return await service.update_tag(db, tag_id, **payload.model_dump(exclude_unset=True))


@router.delete("/tags/{tag_id}", status_code=204)
async def delete_tag(tag_id: UUID, author: Author, db: Db) -> None:
    await service.delete_tag(db, tag_id)


@router.put("/tags/assign")
async def assign_tags(payload: TagsForIn, author: Author, db: Db):
    ids = await service.set_tags_for(
        db, payload.target_type, payload.target_id, payload.tag_ids
    )
    return {"tag_ids": ids}


@router.get("/tags/of/{target_type}/{target_id}")
async def tags_of(target_type: str, target_id: UUID, author: Author, db: Db):
    return await service.tags_of(db, target_type, target_id)


# --- Colecciones -------------------------------------------------------------


class CollectionIn(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    lang: str = Field(default="es", pattern="^(es|en)$")


class CollectionPatch(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    title: str | None = Field(default=None, max_length=300)
    description: str | None = None
    lang: str = Field(default="es", pattern="^(es|en)$")


class CollectionItemIn(BaseModel):
    target_type: str = Field(pattern="^(project|lesson|resource|assessment)$")
    target_id: UUID


class CollectionItemsIn(BaseModel):
    items: list[CollectionItemIn]


@router.get("/collections")
async def list_collections(author: Author, db: Db, lang: str = "es"):
    return await service.list_collections(db, lang=lang)


@router.get("/collections/{collection_id}")
async def get_collection(
    collection_id: UUID, author: Author, db: Db, lang: str = "es"
):
    return await service.get_collection(db, collection_id, lang=lang)


@router.post("/collections", status_code=201)
async def create_collection(payload: CollectionIn, author: Author, db: Db):
    return await service.create_collection(db, **payload.model_dump())


@router.patch("/collections/{collection_id}")
async def update_collection(
    collection_id: UUID, payload: CollectionPatch, author: Author, db: Db
):
    datos = payload.model_dump(exclude_unset=True)
    lang = datos.pop("lang", "es")
    return await service.update_collection(db, collection_id, lang=lang, **datos)


@router.put("/collections/{collection_id}/items")
async def set_collection_items(
    collection_id: UUID, payload: CollectionItemsIn, author: Author, db: Db
):
    entradas = [
        {"target_type": i.target_type, "target_id": str(i.target_id)}
        for i in payload.items
    ]
    return await service.set_collection_items(db, collection_id, entradas)


@router.delete("/collections/{collection_id}", status_code=204)
async def delete_collection(collection_id: UUID, author: Author, db: Db) -> None:
    await service.delete_collection(db, collection_id)

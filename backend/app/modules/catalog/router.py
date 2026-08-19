"""Endpoints de autoria del Content Studio.

Todo bajo el guard `Author` (editor/admin): el docente ve la guia didactica
pero NO entra al editor. La autorizacion real vive aqui, no en React.
"""

from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.deps import Author, Db
from app.modules.catalog import service
from app.modules.catalog.models import BlockKind

router = APIRouter(prefix="/studio/catalog", tags=["studio"])


class ProjectIn(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    grade: str = Field(min_length=1, max_length=20)
    title: str = Field(min_length=1, max_length=300)
    kit: str | None = Field(default=None, max_length=120)
    order: int = 0
    summary: str | None = None
    lang: str = Field(default="es", pattern="^(es|en)$")


class ProjectPatch(BaseModel):
    """Parcial: lo que no venga, no se toca.

    `status` no esta aqui a proposito — publicar es de `publishing`.
    """

    slug: str | None = Field(default=None, min_length=1, max_length=120)
    grade: str | None = Field(default=None, min_length=1, max_length=20)
    title: str | None = Field(default=None, min_length=1, max_length=300)
    kit: str | None = Field(default=None, max_length=120)
    order: int | None = None
    summary: str | None = None
    lang: str = Field(default="es", pattern="^(es|en)$")


@router.get("/projects")
async def list_projects(
    author: Author, db: Db, lang: str = "es", grade: str | None = None
):
    """Incluye borradores: es la vista del editor, no la del estudiante."""
    return await service.list_projects(db, lang=lang, grade=grade)


@router.post("/projects", status_code=201)
async def create_project(payload: ProjectIn, author: Author, db: Db):
    return await service.create_project(db, **payload.model_dump())


@router.get("/projects/{project_id}")
async def get_project(project_id: UUID, author: Author, db: Db, lang: str = "es"):
    return await service.get_project(db, project_id, lang=lang)


@router.patch("/projects/{project_id}")
async def update_project(
    project_id: UUID, payload: ProjectPatch, author: Author, db: Db
):
    datos = payload.model_dump(exclude_unset=True)
    lang = datos.pop("lang", "es")
    return await service.update_project(db, project_id, lang=lang, **datos)


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: UUID, author: Author, db: Db) -> None:
    await service.delete_project(db, project_id)


# --- Momentos --------------------------------------------------------------
#
# Sin POST ni DELETE a proposito: son seis, fijos, y los crea el proyecto (R7).


class MomentPatch(BaseModel):
    """Parcial, por idioma. `type` y `order` no se tocan: los fija R7."""

    title: str | None = Field(default=None, max_length=300)
    # R4: instrucciones de aula, sólo para el docente.
    teacher_note: str | None = None
    # R8: la pregunta con la que el chat abre el momento.
    chatbot_opening_prompt: str | None = None
    lang: str = Field(default="es", pattern="^(es|en)$")


@router.get("/moments/{moment_id}")
async def get_moment(moment_id: UUID, author: Author, db: Db, lang: str = "es"):
    return await service.get_moment(db, moment_id, lang=lang)


@router.patch("/moments/{moment_id}")
async def update_moment(
    moment_id: UUID, payload: MomentPatch, author: Author, db: Db
):
    datos = payload.model_dump(exclude_unset=True)
    lang = datos.pop("lang", "es")
    return await service.update_moment(db, moment_id, lang=lang, **datos)


@router.get("/projects/{project_id}/translations")
async def estado_de_traduccion(project_id: UUID, author: Author, db: Db):
    """Qué le falta al proyecto para servirse en cada idioma (S4).

    Mismo criterio que decide si un idioma entra al snapshot: si aquí sale
    `complete`, publicar lo incluye.
    """
    return await service.estado_de_traduccion(db, project_id)


# --- Bloques ---------------------------------------------------------------


class BlockIn(BaseModel):
    kind: BlockKind
    media_asset_id: UUID | None = None
    body: str | None = None
    caption: str | None = None
    alt_text: str | None = Field(default=None, max_length=500)
    lang: str = Field(default="es", pattern="^(es|en)$")


class BlockPatch(BaseModel):
    """Parcial. `order` no está: se reordena en bloque, no de uno en uno."""

    kind: BlockKind | None = None
    media_asset_id: UUID | None = None
    body: str | None = None
    caption: str | None = None
    alt_text: str | None = Field(default=None, max_length=500)
    lang: str = Field(default="es", pattern="^(es|en)$")


class OrderIn(BaseModel):
    block_ids: list[UUID] = Field(min_length=1)


@router.get("/moments/{moment_id}/blocks")
async def list_blocks(moment_id: UUID, author: Author, db: Db, lang: str = "es"):
    return await service.list_blocks(db, moment_id, lang=lang)


@router.post("/moments/{moment_id}/blocks", status_code=201)
async def create_block(moment_id: UUID, payload: BlockIn, author: Author, db: Db):
    return await service.create_block(db, moment_id, **payload.model_dump())


@router.put("/moments/{moment_id}/blocks/order")
async def reorder_blocks(moment_id: UUID, payload: OrderIn, author: Author, db: Db):
    """El drag & drop manda el orden completo, no un movimiento."""
    return await service.reorder_blocks(db, moment_id, payload.block_ids)


@router.patch("/blocks/{block_id}")
async def update_block(block_id: UUID, payload: BlockPatch, author: Author, db: Db):
    datos = payload.model_dump(exclude_unset=True)
    lang = datos.pop("lang", "es")
    return await service.update_block(db, block_id, lang=lang, **datos)


@router.delete("/blocks/{block_id}", status_code=204)
async def delete_block(block_id: UUID, author: Author, db: Db) -> None:
    await service.delete_block(db, block_id)

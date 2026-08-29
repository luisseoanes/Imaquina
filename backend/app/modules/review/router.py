"""Comentarios de revisión e historial. Bajo `Author` (editor/admin)."""

from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.deps import Author, Db
from app.modules.review import service

router = APIRouter(prefix="/studio/review", tags=["studio"])


@router.get("/{target_type}/{target_id}")
async def historial(target_type: str, target_id: UUID, author: Author, db: Db):
    return await service.historial(db, target_type, target_id)


class CommentIn(BaseModel):
    target_type: str = Field(pattern="^(project|lesson)$")
    target_id: UUID
    body: str = Field(min_length=1)
    moment_id: UUID | None = None
    block_id: UUID | None = None


@router.post("/comments", status_code=201)
async def comentar(payload: CommentIn, author: Author, db: Db):
    return await service.comentar(
        db,
        author,
        target_type=payload.target_type,
        target_id=payload.target_id,
        body=payload.body,
        moment_id=payload.moment_id,
        block_id=payload.block_id,
    )


class ResolveIn(BaseModel):
    resolved: bool = True


@router.post("/comments/{comment_id}/resolve")
async def resolver(comment_id: UUID, payload: ResolveIn, author: Author, db: Db):
    return await service.resolver(db, comment_id, resuelto=payload.resolved)

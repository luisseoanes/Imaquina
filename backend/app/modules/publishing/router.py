from uuid import UUID

from fastapi import APIRouter

from app.core.deps import Author, Db
from app.modules.publishing import service
from app.workers.tasks import enqueue_reindex

router = APIRouter(prefix="/studio/publishing", tags=["studio"])


@router.post("/projects/{project_id}/validate")
async def validate(project_id: UUID, author: Author, db: Db, lang: str = "es"):
    return {"problems": await service.check_publishable(db, project_id, lang)}


@router.post("/projects/{project_id}/publish")
async def publish(project_id: UUID, author: Author, db: Db, lang: str = "es"):
    version = await service.publish(
        db, project_id, published_by=author.user_id, lang=lang
    )
    # El reindexado del RAG va en background y es automatico: nadie se va a
    # acordar de apretar "reindexar" (ARQUITECTURA.md 7).
    await enqueue_reindex(project_id)
    return {"version": version.version, "published_at": version.published_at}


@router.post("/projects/{project_id}/rollback/{version}")
async def rollback(project_id: UUID, version: int, author: Author, db: Db):
    target = await service.rollback(db, project_id, version)
    await enqueue_reindex(project_id)
    return {"version": target.version, "is_current": True}

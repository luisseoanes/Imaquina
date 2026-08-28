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
    from app.modules.audit import service as audit

    version = await service.publish(
        db, project_id, published_by=author.user_id, lang=lang
    )
    await audit.record(
        db,
        institution_id=author.require_institution(),
        actor_id=author.user_id,
        action="project.publish",
        target_type="project",
        target_id=project_id,
        summary=f"Publicó el proyecto (versión {version.version})",
    )
    # El reindexado del RAG va en background y es automatico: nadie se va a
    # acordar de apretar "reindexar" (arquitectura.md 7).
    await enqueue_reindex(project_id)
    return {"version": version.version, "published_at": version.published_at}


@router.post("/projects/{project_id}/unpublish")
async def unpublish(project_id: UUID, author: Author, db: Db):
    from app.modules.audit import service as audit

    project = await service.unpublish(db, project_id)
    await audit.record(
        db,
        institution_id=author.require_institution(),
        actor_id=author.user_id,
        action="project.unpublish",
        target_type="project",
        target_id=project_id,
        summary="Despublicó el proyecto",
    )
    # El contenido deja de estar disponible: se reindexa para vaciar sus
    # chunks del RAG (reindex_project cae a la rama "sin publicar").
    await enqueue_reindex(project_id)
    return {"status": project.status}


@router.post("/projects/{project_id}/rollback/{version}")
async def rollback(project_id: UUID, version: int, author: Author, db: Db):
    target = await service.rollback(db, project_id, version)
    await enqueue_reindex(project_id)
    return {"version": target.version, "is_current": True}

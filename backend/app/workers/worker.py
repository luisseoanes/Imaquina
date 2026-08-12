"""Worker ARQ. Arrancar con:  arq app.workers.worker.WorkerSettings"""

import uuid

from arq.connections import RedisSettings

from app.core.config import settings
from app.db.session import SessionLocal


async def reindex_project(ctx: dict, project_id: str) -> dict:
    """IDEMPOTENTE: borra los chunks del proyecto y los regenera.

    Se va a reintentar, asi que nunca acumular.
    """
    from sqlalchemy import delete, select

    from app.modules.assistant.models import DocumentChunk
    from app.modules.publishing.models import ProjectVersion

    pid = uuid.UUID(project_id)
    async with SessionLocal() as db:
        await db.execute(
            delete(DocumentChunk).where(DocumentChunk.project_id == pid)
        )

        snapshot = (
            await db.execute(
                select(ProjectVersion.snapshot).where(
                    ProjectVersion.project_id == pid,
                    ProjectVersion.is_current.is_(True),
                )
            )
        ).scalar_one_or_none()

        if snapshot is None:
            await db.commit()
            return {"project_id": project_id, "chunks": 0, "reason": "sin publicar"}

        count = 0
        for moment in snapshot["moments"]:
            for block in moment["blocks"]:
                body = (block.get("body") or "").strip()
                if not body:
                    continue
                # TODO: generar embedding real. Placeholder hasta cablear el
                # modelo de embeddings (ver docs/SCOPE-MVP.md F4).
                db.add(
                    DocumentChunk(
                        project_id=pid,
                        moment_id=uuid.UUID(moment["id"]),
                        lang=snapshot["lang"],
                        content=body,
                        embedding=[0.0] * settings.EMBEDDING_DIM,
                    )
                )
                count += 1

        await db.commit()
    return {"project_id": project_id, "chunks": count}


async def export_results(ctx: dict, assessment_id: str, requested_by: str) -> dict:
    """Genera el XLSX del tablero docente (R10). TODO: openpyxl."""
    return {"assessment_id": assessment_id, "status": "pendiente"}


class WorkerSettings:
    functions = [reindex_project, export_results]
    redis_settings = RedisSettings.from_dsn(str(settings.REDIS_URL))
    max_jobs = 10
    job_timeout = 300

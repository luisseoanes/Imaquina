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

        # Un chunk por idioma: el snapshot lleva todas las traducciones y el
        # chat responde en el idioma del estudiante. Indexar solo uno dejaba
        # al que pregunta en ingles recuperando contexto en español.
        count = 0
        for lang in snapshot.get("langs", []):
            for moment in snapshot["content"][lang]["moments"]:
                for block in moment["blocks"]:
                    body = (block.get("body") or "").strip()
                    if not body:
                        continue
                    # TODO: generar embedding real. Placeholder hasta cablear
                    # el modelo de embeddings (ver docs/scope-mvp.md F4).
                    db.add(
                        DocumentChunk(
                            project_id=pid,
                            moment_id=uuid.UUID(moment["id"]),
                            lang=lang,
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


async def delete_orphaned_media(ctx: dict, s3_key: str) -> dict:
    """IDEMPOTENTE: borra el objeto del bucket solo si ya no hay ninguna fila
    de `MediaAsset` con esta `s3_key` (S19).

    `media.service.borrar` da de baja el registro sin tocar el bucket -- el
    fichero queda huerfano hasta que este trabajo lo limpia. La comprobacion
    de nuevo aqui es la guarda contra condiciones de carrera; `delete_object`
    de S3 ya es idempotente si el objeto no existe.
    """
    import boto3
    from sqlalchemy import select

    from app.modules.media.models import MediaAsset

    async with SessionLocal() as db:
        sigue_referenciado = (
            await db.execute(
                select(MediaAsset.id).where(MediaAsset.s3_key == s3_key)
            )
        ).scalar_one_or_none()

    if sigue_referenciado is not None:
        return {"s3_key": s3_key, "borrado": False, "razon": "en uso"}

    s3 = boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    )
    s3.delete_object(Bucket=settings.S3_BUCKET, Key=s3_key)
    return {"s3_key": s3_key, "borrado": True}


class WorkerSettings:
    functions = [reindex_project, export_results, delete_orphaned_media]
    redis_settings = RedisSettings.from_dsn(str(settings.REDIS_URL))
    max_jobs = 10
    job_timeout = 300

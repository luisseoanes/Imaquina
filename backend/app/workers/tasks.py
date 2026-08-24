"""Trabajos en background (ARQ sobre Redis).

Tres razones para existir: reindexar el RAG al publicar, generar exports XLSX,
y enviar correos. Ninguna puede bloquear un request HTTP.
"""

import uuid

from arq import create_pool
from arq.connections import RedisSettings

from app.core.config import settings


def _redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(str(settings.REDIS_URL))


async def enqueue_reindex(project_id: uuid.UUID) -> None:
    pool = await create_pool(_redis_settings())
    await pool.enqueue_job("reindex_project", str(project_id))


async def enqueue_export(assessment_id: uuid.UUID, requested_by: uuid.UUID) -> None:
    pool = await create_pool(_redis_settings())
    await pool.enqueue_job("export_results", str(assessment_id), str(requested_by))


async def enqueue_media_cleanup(s3_key: str) -> None:
    pool = await create_pool(_redis_settings())
    await pool.enqueue_job("delete_orphaned_media", s3_key)

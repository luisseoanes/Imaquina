"""Comentarios de revisión e historial de estado.

`registrar_evento` NO hace commit: se engancha a la transacción de quien la
llama (`catalog.service` al cambiar el estado del proyecto).
"""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import TenantContext
from app.core.errors import NotFound
from app.modules.review.models import ReviewComment, ReviewEvent


async def registrar_evento(
    db: AsyncSession,
    *,
    target_type: str,
    target_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    from_status: str | None,
    to_status: str,
    note: str | None = None,
) -> None:
    db.add(
        ReviewEvent(
            target_type=target_type,
            target_id=target_id,
            actor_id=actor_id,
            from_status=from_status,
            to_status=to_status,
            note=note,
        )
    )
    await db.flush()


def _serializar_comentario(c: ReviewComment) -> dict[str, Any]:
    return {
        "id": str(c.id),
        "target_type": c.target_type,
        "target_id": str(c.target_id),
        "moment_id": str(c.moment_id) if c.moment_id else None,
        "block_id": str(c.block_id) if c.block_id else None,
        "author_id": str(c.author_id) if c.author_id else None,
        "body": c.body,
        "resolved": c.resolved_at is not None,
        "created_at": c.created_at.isoformat(),
    }


def _serializar_evento(e: ReviewEvent) -> dict[str, Any]:
    return {
        "id": str(e.id),
        "actor_id": str(e.actor_id) if e.actor_id else None,
        "from_status": e.from_status,
        "to_status": e.to_status,
        "note": e.note,
        "created_at": e.created_at.isoformat(),
    }


async def historial(
    db: AsyncSession, target_type: str, target_id: uuid.UUID
) -> dict[str, Any]:
    comentarios = (
        (
            await db.execute(
                select(ReviewComment)
                .where(
                    ReviewComment.target_type == target_type,
                    ReviewComment.target_id == target_id,
                )
                .order_by(ReviewComment.created_at)
            )
        )
        .scalars()
        .all()
    )
    eventos = (
        (
            await db.execute(
                select(ReviewEvent)
                .where(
                    ReviewEvent.target_type == target_type,
                    ReviewEvent.target_id == target_id,
                )
                .order_by(ReviewEvent.created_at)
            )
        )
        .scalars()
        .all()
    )
    return {
        "comments": [_serializar_comentario(c) for c in comentarios],
        "events": [_serializar_evento(e) for e in eventos],
    }


async def comentar(
    db: AsyncSession,
    tenant: TenantContext,
    *,
    target_type: str,
    target_id: uuid.UUID,
    body: str,
    moment_id: uuid.UUID | None = None,
    block_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    comentario = ReviewComment(
        target_type=target_type,
        target_id=target_id,
        moment_id=moment_id,
        block_id=block_id,
        author_id=tenant.user_id,
        body=body,
    )
    db.add(comentario)
    await db.flush()
    return _serializar_comentario(comentario)


async def resolver(
    db: AsyncSession, comment_id: uuid.UUID, *, resuelto: bool
) -> dict[str, Any]:
    from datetime import UTC, datetime

    comentario = (
        await db.execute(select(ReviewComment).where(ReviewComment.id == comment_id))
    ).scalar_one_or_none()
    if comentario is None:
        raise NotFound("Comentario no encontrado")
    comentario.resolved_at = datetime.now(UTC) if resuelto else None
    await db.flush()
    return _serializar_comentario(comentario)

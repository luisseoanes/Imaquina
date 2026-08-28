import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.audit.models import AuditEntry
from app.modules.identity.models import User


async def record(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    action: str,
    summary: str,
    actor_id: uuid.UUID | None = None,
    target_type: str | None = None,
    target_id: uuid.UUID | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    """No hace commit: se engancha a la transacción de quien lo llama, así que
    si la acción se revierte, su registro también."""
    db.add(
        AuditEntry(
            institution_id=institution_id,
            actor_id=actor_id,
            action=action,
            summary=summary,
            target_type=target_type,
            target_id=target_id,
            meta=meta,
        )
    )
    await db.flush()


async def listar(
    db: AsyncSession,
    institution_id: uuid.UUID,
    *,
    action: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    filtros = [AuditEntry.institution_id == institution_id]
    if action:
        filtros.append(AuditEntry.action == action)

    total = (
        await db.execute(select(func.count(AuditEntry.id)).where(*filtros))
    ).scalar_one()

    filas = (
        await db.execute(
            select(AuditEntry, User.full_name)
            .outerjoin(User, User.id == AuditEntry.actor_id)
            .where(*filtros)
            .order_by(AuditEntry.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()

    return {
        "total": int(total),
        "items": [
            {
                "id": str(e.id),
                "action": e.action,
                "actor": actor_name,
                "target_type": e.target_type,
                "target_id": str(e.target_id) if e.target_id else None,
                "summary": e.summary,
                "meta": e.meta,
                "created_at": e.created_at.isoformat(),
            }
            for e, actor_name in filas
        ],
    }

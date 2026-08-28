"""Notificaciones: crear (lo llaman otros módulos) y consumir (el destinatario).

`notify`/`notify_many` NO hacen commit: se enganchan a la transacción del
request que las dispara (crear una asignación y avisar a los alumnos son un
todo o nada).
"""

import uuid
from collections.abc import Iterable
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import TenantContext
from app.modules.notifications.models import Notification


def _serialize(n: Notification) -> dict[str, Any]:
    return {
        "id": str(n.id),
        "kind": n.kind,
        "title": n.title,
        "body": n.body,
        "link": n.link,
        "created_at": n.created_at.isoformat(),
        "read": n.read_at is not None,
    }


async def notify(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    institution_id: uuid.UUID,
    kind: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
) -> None:
    db.add(
        Notification(
            user_id=user_id,
            institution_id=institution_id,
            kind=kind,
            title=title,
            body=body,
            link=link,
        )
    )
    await db.flush()


async def notify_many(
    db: AsyncSession,
    *,
    user_ids: Iterable[uuid.UUID],
    institution_id: uuid.UUID,
    kind: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
) -> None:
    ids = list(dict.fromkeys(user_ids))  # sin duplicados, orden estable
    if not ids:
        return
    db.add_all(
        Notification(
            user_id=uid,
            institution_id=institution_id,
            kind=kind,
            title=title,
            body=body,
            link=link,
        )
        for uid in ids
    )
    await db.flush()


async def listar(
    db: AsyncSession, tenant: TenantContext, *, limit: int = 30
) -> dict[str, Any]:
    filas = (
        (
            await db.execute(
                select(Notification)
                .where(
                    Notification.user_id == tenant.user_id,
                    Notification.institution_id == tenant.require_institution(),
                )
                .order_by(Notification.created_at.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return {
        "items": [_serialize(n) for n in filas],
        "unread": sum(1 for n in filas if n.read_at is None),
    }


async def contar_no_leidas(db: AsyncSession, tenant: TenantContext) -> int:
    return int(
        (
            await db.execute(
                select(func.count(Notification.id)).where(
                    Notification.user_id == tenant.user_id,
                    Notification.institution_id == tenant.require_institution(),
                    Notification.read_at.is_(None),
                )
            )
        ).scalar_one()
    )


async def marcar_leida(
    db: AsyncSession, tenant: TenantContext, notification_id: uuid.UUID
) -> None:
    await db.execute(
        update(Notification)
        .where(
            Notification.id == notification_id,
            Notification.user_id == tenant.user_id,
        )
        .values(read_at=func.now())
    )
    await db.flush()


async def marcar_todas_leidas(db: AsyncSession, tenant: TenantContext) -> None:
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == tenant.user_id,
            Notification.institution_id == tenant.require_institution(),
            Notification.read_at.is_(None),
        )
        .values(read_at=func.now())
    )
    await db.flush()

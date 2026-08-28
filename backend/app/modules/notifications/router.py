from uuid import UUID

from fastapi import APIRouter

from app.core.deps import Db, Tenant
from app.modules.notifications import service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(tenant: Tenant, db: Db, limit: int = 30):
    return await service.listar(db, tenant, limit=limit)


@router.get("/unread-count")
async def unread_count(tenant: Tenant, db: Db):
    return {"unread": await service.contar_no_leidas(db, tenant)}


@router.post("/{notification_id}/read", status_code=204)
async def mark_read(notification_id: UUID, tenant: Tenant, db: Db) -> None:
    await service.marcar_leida(db, tenant, notification_id)


@router.post("/read-all", status_code=204)
async def mark_all_read(tenant: Tenant, db: Db) -> None:
    await service.marcar_todas_leidas(db, tenant)

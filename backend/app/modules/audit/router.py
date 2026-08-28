from fastapi import APIRouter, Query

from app.core.deps import Admin, Db
from app.modules.audit import service

router = APIRouter(prefix="/admin/audit", tags=["admin"])


@router.get("")
async def list_audit(
    admin: Admin,
    db: Db,
    action: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return await service.listar(
        db, admin.require_institution(), action=action, limit=limit, offset=offset
    )

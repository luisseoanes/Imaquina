from fastapi import APIRouter, Query

from app.core.deps import Db, Tenant
from app.modules.search import service

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
async def search(tenant: Tenant, db: Db, q: str = Query(min_length=0, max_length=120)):
    return await service.buscar(db, tenant, q)

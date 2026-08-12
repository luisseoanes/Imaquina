from uuid import UUID

from fastapi import APIRouter

from app.core.deps import Db, Tenant
from app.modules.learning import service

router = APIRouter(prefix="/learn", tags=["learning"])


@router.get("/projects")
async def list_projects(tenant: Tenant, db: Db, grade: str | None = None):
    return await service.list_published_projects(db, grade=grade)


@router.get("/projects/{project_id}")
async def get_project(project_id: UUID, tenant: Tenant, db: Db):
    snapshot = await service.get_project_snapshot(db, project_id)
    return {
        **snapshot,
        "moments": [
            service.serialize_moment_for(m, tenant) for m in snapshot["moments"]
        ],
    }


@router.get("/projects/{project_id}/moments/{moment_type}")
async def get_moment(project_id: UUID, moment_type: str, tenant: Tenant, db: Db):
    return await service.get_moment_for(db, project_id, moment_type, tenant)

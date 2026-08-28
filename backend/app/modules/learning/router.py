from uuid import UUID

from fastapi import APIRouter

from app.core.deps import Db, Staff, Tenant
from app.modules.learning import service

router = APIRouter(prefix="/learn", tags=["learning"])


@router.get("/projects")
async def list_projects(
    tenant: Tenant, db: Db, grade: str | None = None, lang: str = "es"
):
    return await service.list_published_projects(db, lang=lang, grade=grade)


@router.get("/projects/{project_id}")
async def get_project(project_id: UUID, tenant: Tenant, db: Db, lang: str = "es"):
    snapshot = await service.get_project_snapshot(db, project_id)
    return await service.project_for(db, snapshot, tenant, lang=lang)


@router.get("/projects/{project_id}/moments/{moment_type}")
async def get_moment(
    project_id: UUID, moment_type: str, tenant: Tenant, db: Db, lang: str = "es"
):
    return await service.get_moment_for(db, project_id, moment_type, tenant, lang=lang)


# --- Progreso (N5) -----------------------------------------------------------


@router.get("/projects/{project_id}/progress")
async def get_progress(project_id: UUID, tenant: Tenant, db: Db):
    return await service.progreso_de(db, tenant, project_id)


@router.post("/projects/{project_id}/moments/{moment_type}/complete", status_code=204)
async def complete_moment(
    project_id: UUID, moment_type: str, tenant: Tenant, db: Db
) -> None:
    await service.marcar_completado(db, tenant, project_id, moment_type)


# --- Panel docente (N6) -------------------------------------------------------


@router.get("/teacher/courses/{course_id}/progress")
async def course_progress(course_id: UUID, project_id: UUID, staff: Staff, db: Db):
    return await service.progreso_del_curso(db, staff, course_id, project_id)

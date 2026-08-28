from datetime import datetime
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.deps import Db, Staff, Tenant
from app.modules.assignments import service

router = APIRouter(prefix="/assignments", tags=["assignments"])


class AssignmentIn(BaseModel):
    course_ids: list[UUID] = Field(min_length=1)
    project_id: UUID
    title: str = Field(min_length=1, max_length=200)
    instructions: str | None = None
    due_at: datetime | None = None
    is_published: bool = True


class AssignmentPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    instructions: str | None = None
    due_at: datetime | None = None
    is_published: bool | None = None


@router.get("")
async def list_assignments(staff: Staff, db: Db, course_id: UUID | None = None):
    return await service.list_for_staff(db, staff, course_id=course_id)


@router.get("/mine")
async def my_assignments(tenant: Tenant, db: Db):
    """La agenda del estudiante: sus tareas con estado y puntualidad."""
    return await service.list_for_student(db, tenant)


@router.post("", status_code=201)
async def create_assignment(payload: AssignmentIn, staff: Staff, db: Db):
    return await service.create(
        db,
        staff,
        course_ids=payload.course_ids,
        project_id=payload.project_id,
        title=payload.title,
        instructions=payload.instructions,
        due_at=payload.due_at,
        is_published=payload.is_published,
    )


@router.get("/{assignment_id}")
async def get_assignment(assignment_id: UUID, staff: Staff, db: Db):
    return await service.get_one(db, staff, assignment_id)


@router.patch("/{assignment_id}")
async def update_assignment(
    assignment_id: UUID, payload: AssignmentPatch, staff: Staff, db: Db
):
    return await service.update(
        db, staff, assignment_id, **payload.model_dump(exclude_unset=True)
    )


@router.delete("/{assignment_id}", status_code=204)
async def delete_assignment(assignment_id: UUID, staff: Staff, db: Db) -> None:
    await service.delete(db, staff, assignment_id)


@router.get("/{assignment_id}/tracking")
async def assignment_tracking(assignment_id: UUID, staff: Staff, db: Db):
    return await service.tracking(db, staff, assignment_id)

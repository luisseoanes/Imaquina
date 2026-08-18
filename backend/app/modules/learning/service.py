"""Camino de lectura del estudiante.

Sirve desde el snapshot publicado (arquitectura.md 3.1): UNA query, cacheable,
en vez de joins sobre 5 tablas en cada request.
"""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import TenantContext
from app.core.errors import NotFound
from app.modules.catalog.models import Project, ProjectStatus
from app.modules.publishing.models import ProjectVersion


async def list_published_projects(
    db: AsyncSession, *, grade: str | None = None
) -> list[dict[str, Any]]:
    stmt = (
        select(ProjectVersion.snapshot)
        .join(Project, Project.id == ProjectVersion.project_id)
        .where(
            ProjectVersion.is_current.is_(True),
            Project.status == ProjectStatus.PUBLISHED,
        )
        .order_by(Project.order)
    )
    if grade:
        stmt = stmt.where(Project.grade == grade)

    rows = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": s["id"],
            "slug": s["slug"],
            "grade": s["grade"],
            "title": s["title"],
            "summary": s.get("summary"),
        }
        for s in rows
    ]


async def get_project_snapshot(
    db: AsyncSession, project_id: uuid.UUID
) -> dict[str, Any]:
    snapshot = (
        await db.execute(
            select(ProjectVersion.snapshot).where(
                ProjectVersion.project_id == project_id,
                ProjectVersion.is_current.is_(True),
            )
        )
    ).scalar_one_or_none()
    if snapshot is None:
        raise NotFound("El proyecto no está publicado")
    return snapshot


def serialize_moment_for(moment: dict[str, Any], tenant: TenantContext) -> dict[str, Any]:
    """R4: el docente ve lo mismo que el estudiante MÁS la guía didáctica.

    El filtro ocurre AQUÍ, en el backend. Ocultarla en el frontend con CSS o
    un `if` de React no sirve: cualquier estudiante abre DevTools y lee el JSON.
    """
    out = {k: v for k, v in moment.items() if k != "teacher_note"}
    if tenant.is_staff:
        out["teacher_note"] = moment.get("teacher_note")
    return out


async def get_moment_for(
    db: AsyncSession,
    project_id: uuid.UUID,
    moment_type: str,
    tenant: TenantContext,
) -> dict[str, Any]:
    snapshot = await get_project_snapshot(db, project_id)
    moment = next(
        (m for m in snapshot["moments"] if m["type"] == moment_type), None
    )
    if moment is None:
        raise NotFound(f"El momento '{moment_type}' no existe en este proyecto")
    return serialize_moment_for(moment, tenant)

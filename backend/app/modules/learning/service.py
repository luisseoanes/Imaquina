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
from app.modules.publishing.service import contenido_en


async def list_published_projects(
    db: AsyncSession, *, lang: str = "es", grade: str | None = None
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

    fichas = []
    for snap in rows:
        servido, c = contenido_en(snap, lang)
        fichas.append(
            {
                "id": snap["id"],
                "slug": snap["slug"],
                "grade": snap["grade"],
                "title": c["title"],
                "summary": c.get("summary"),
                # El idioma REALMENTE servido: puede no ser el pedido si el
                # proyecto no esta traducido. La UI avisa con esto.
                "lang": servido,
            }
        )
    return fichas


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


def serialize_project_for(
    snapshot: dict[str, Any], tenant: TenantContext, *, lang: str = "es"
) -> dict[str, Any]:
    """Cabecera del proyecto + sus momentos, en un solo idioma.

    Nunca se devuelve el snapshot entero: lleva dentro TODOS los idiomas y la
    guia docente de todos ellos.
    """
    servido, c = contenido_en(snapshot, lang)
    return {
        "id": snapshot["id"],
        "slug": snapshot["slug"],
        "grade": snapshot["grade"],
        "kit": snapshot.get("kit"),
        "lang": servido,
        "langs": snapshot.get("langs", []),
        "title": c["title"],
        "summary": c.get("summary"),
        "moments": [serialize_moment_for(m, tenant) for m in c["moments"]],
    }


async def get_moment_for(
    db: AsyncSession,
    project_id: uuid.UUID,
    moment_type: str,
    tenant: TenantContext,
    *,
    lang: str = "es",
) -> dict[str, Any]:
    snapshot = await get_project_snapshot(db, project_id)
    servido, c = contenido_en(snapshot, lang)
    moment = next((m for m in c["moments"] if m["type"] == moment_type), None)
    if moment is None:
        raise NotFound(f"El momento '{moment_type}' no existe en este proyecto")
    return {**serialize_moment_for(moment, tenant), "lang": servido}

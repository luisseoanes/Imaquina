"""Agregados de tablero del Studio: dashboard, analítica y actividad.

Sólo LECTURA, y sólo sobre modelos de otros módulos (`catalog`, `assessment`,
`learning`, `identity`) — permitido por la regla de dependencia de
`arquitectura.md` §2. Nada de escritura cruzada.

Lo que toca datos de estudiantes (intentos, progreso, cuentas) se filtra
SIEMPRE por `institution_id`: quien llama pasa `Staff.require_institution()`.
El catálogo de contenido es global y no lleva filtro.
"""

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.assessment.models import Assessment, Attempt, AttemptStatus
from app.modules.catalog.models import Moment, Project, ProjectStatus
from app.modules.identity.models import User
from app.modules.learning.models import Progress, ProgressState
from app.modules.studio.models import (
    Collection,
    ContentStatus,
    LearningPath,
    Lesson,
    Resource,
)


async def _count(db: AsyncSession, stmt) -> int:
    return int((await db.execute(stmt)).scalar_one() or 0)


async def dashboard(db: AsyncSession, institution_id: uuid.UUID) -> dict[str, Any]:
    """Las tarjetas de arriba del mockup + contenido reciente + rendimiento."""
    total_projects = await _count(db, select(func.count(Project.id)))
    published_projects = await _count(
        db,
        select(func.count(Project.id)).where(
            Project.status == ProjectStatus.PUBLISHED
        ),
    )
    total_lessons = await _count(db, select(func.count(Lesson.id)))
    published_lessons = await _count(
        db,
        select(func.count(Lesson.id)).where(Lesson.status == ContentStatus.PUBLISHED),
    )
    total_resources = await _count(db, select(func.count(Resource.id)))
    total_paths = await _count(db, select(func.count(LearningPath.id)))
    total_collections = await _count(db, select(func.count(Collection.id)))

    students = await _count(
        db,
        select(func.count(User.id)).where(
            User.institution_id == institution_id,
            User.role == "student",
            User.is_active.is_(True),
        ),
    )

    # Rendimiento: sobre intentos ENVIADOS de esta institución.
    graded = (
        await db.execute(
            select(
                func.count(Attempt.id),
                func.avg(Attempt.score),
            ).where(
                Attempt.institution_id == institution_id,
                Attempt.status.in_(
                    (AttemptStatus.SUBMITTED, AttemptStatus.GRADED)
                ),
            )
        )
    ).one()
    completed_moments = await _count(
        db,
        select(func.count(Progress.id)).where(
            Progress.institution_id == institution_id,
            Progress.state == ProgressState.COMPLETED,
        ),
    )

    return {
        "content": {
            "projects": {"total": total_projects, "published": published_projects},
            "lessons": {"total": total_lessons, "published": published_lessons},
            "resources": total_resources,
            "paths": total_paths,
            "collections": total_collections,
        },
        "students_impacted": students,
        "performance": {
            "submitted_attempts": int(graded[0] or 0),
            "avg_score": round(float(graded[1]), 1) if graded[1] is not None else None,
            "completed_moments": completed_moments,
        },
        "recent": await recent_content(db, limit=6),
    }


async def recent_content(
    db: AsyncSession, *, limit: int = 10
) -> list[dict[str, Any]]:
    """Proyectos y lecciones editados hace poco, mezclados y ordenados."""
    proyectos = (
        await db.execute(
            select(Project)
            .options()
            .order_by(Project.updated_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    lecciones = (
        await db.execute(
            select(Lesson).order_by(Lesson.updated_at.desc()).limit(limit)
        )
    ).scalars().all()

    filas: list[dict[str, Any]] = []
    for p in proyectos:
        filas.append(
            {
                "id": str(p.id),
                "type": "project",
                "title": p.slug,
                "area": p.grade,
                "status": p.status,
                "updated_at": p.updated_at.isoformat(),
            }
        )
    for x in lecciones:
        filas.append(
            {
                "id": str(x.id),
                "type": "lesson",
                "title": x.slug,
                "area": x.area,
                "status": x.status,
                "updated_at": x.updated_at.isoformat(),
            }
        )
    filas.sort(key=lambda f: f["updated_at"], reverse=True)
    return filas[:limit]


async def assessment_analytics(
    db: AsyncSession, institution_id: uuid.UUID
) -> list[dict[str, Any]]:
    """Una fila por evaluación con intentos y media, de esta institución."""
    filas = (
        await db.execute(
            select(
                Assessment.id,
                Moment.project_id,
                func.count(Attempt.id),
                func.avg(Attempt.score),
            )
            .select_from(Assessment)
            .join(Moment, Moment.id == Assessment.moment_id)
            .outerjoin(
                Attempt,
                (Attempt.assessment_id == Assessment.id)
                & (Attempt.institution_id == institution_id),
            )
            .group_by(Assessment.id, Moment.project_id)
        )
    ).all()
    return [
        {
            "assessment_id": str(r[0]),
            "project_id": str(r[1]),
            "attempts": int(r[2] or 0),
            "avg_score": round(float(r[3]), 1) if r[3] is not None else None,
        }
        for r in filas
    ]


async def student_activity(
    db: AsyncSession, institution_id: uuid.UUID
) -> list[dict[str, Any]]:
    """Lista de estudiantes de la institución con su actividad resumida."""
    estudiantes = (
        await db.execute(
            select(User)
            .where(User.institution_id == institution_id, User.role == "student")
            .order_by(User.full_name)
        )
    ).scalars().all()

    progreso = dict(
        (
            await db.execute(
                select(Progress.user_id, func.count(Progress.id))
                .where(
                    Progress.institution_id == institution_id,
                    Progress.state == ProgressState.COMPLETED,
                )
                .group_by(Progress.user_id)
            )
        ).all()
    )
    intentos = dict(
        (
            await db.execute(
                select(Attempt.student_id, func.count(Attempt.id))
                .where(Attempt.institution_id == institution_id)
                .group_by(Attempt.student_id)
            )
        ).all()
    )
    ultimo = dict(
        (
            await db.execute(
                select(Progress.user_id, func.max(Progress.updated_at))
                .where(Progress.institution_id == institution_id)
                .group_by(Progress.user_id)
            )
        ).all()
    )

    return [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "grade": u.grade,
            "is_active": u.is_active,
            "completed_moments": int(progreso.get(u.id, 0)),
            "attempts": int(intentos.get(u.id, 0)),
            "last_activity": ultimo[u.id].isoformat() if ultimo.get(u.id) else None,
        }
        for u in estudiantes
    ]

from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import Role, TenantContext
from app.modules.catalog.models import Project, ProjectTranslation
from app.modules.identity.models import Course, User
from app.modules.studio.models import (
    Lesson,
    LessonTranslation,
    Resource,
    ResourceTranslation,
)

LIMITE = 6


async def buscar(
    db: AsyncSession, tenant: TenantContext, q: str
) -> dict[str, list[dict[str, Any]]]:
    q = q.strip()
    if len(q) < 2:
        return {}
    patron = f"%{q}%"
    inst = tenant.require_institution()
    out: dict[str, list[dict[str, Any]]] = {}

    puede_autorear = tenant.role in (Role.EDITOR, Role.ADMIN)
    es_staff = tenant.role in (Role.TEACHER, Role.EDITOR, Role.ADMIN)

    # Proyectos: publicados para todos; con borradores para editor/admin.
    stmt = (
        select(Project.id, ProjectTranslation.title, Project.status)
        .join(ProjectTranslation, ProjectTranslation.project_id == Project.id)
        .where(
            ProjectTranslation.title.ilike(patron),
            ProjectTranslation.lang == "es",
        )
        .limit(LIMITE)
    )
    if not puede_autorear:
        stmt = stmt.where(Project.status == "published")
    proyectos = (await db.execute(stmt)).all()
    if proyectos:
        out["projects"] = [
            {"id": str(pid), "title": title, "status": status}
            for pid, title, status in proyectos
        ]

    if puede_autorear:
        lecciones = (
            await db.execute(
                select(Lesson.id, LessonTranslation.title)
                .join(LessonTranslation, LessonTranslation.lesson_id == Lesson.id)
                .where(
                    LessonTranslation.title.ilike(patron),
                    LessonTranslation.lang == "es",
                )
                .limit(LIMITE)
            )
        ).all()
        if lecciones:
            out["lessons"] = [{"id": str(i), "title": tt} for i, tt in lecciones]

        recursos = (
            await db.execute(
                select(Resource.id, ResourceTranslation.title)
                .join(ResourceTranslation, ResourceTranslation.resource_id == Resource.id)
                .where(
                    ResourceTranslation.title.ilike(patron),
                    ResourceTranslation.lang == "es",
                )
                .limit(LIMITE)
            )
        ).all()
        if recursos:
            out["resources"] = [{"id": str(i), "title": tt} for i, tt in recursos]

    if es_staff:
        cursos = (
            await db.execute(
                select(Course.id, Course.name, Course.grade)
                .where(Course.institution_id == inst, Course.name.ilike(patron))
                .limit(LIMITE)
            )
        ).all()
        if cursos:
            out["courses"] = [
                {"id": str(i), "title": n, "grade": g} for i, n, g in cursos
            ]

    if tenant.role in (Role.ADMIN,):
        usuarios = (
            await db.execute(
                select(User.id, User.full_name, User.email, User.role)
                .where(
                    User.institution_id == inst,
                    or_(User.full_name.ilike(patron), User.email.ilike(patron)),
                )
                .limit(LIMITE)
            )
        ).all()
        if usuarios:
            out["users"] = [
                {"id": str(i), "title": n, "email": e, "role": r}
                for i, n, e, r in usuarios
            ]

    return out

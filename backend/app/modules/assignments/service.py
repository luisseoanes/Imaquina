import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import Role, TenantContext
from app.core.errors import NotFound, PermissionDenied, ValidationFailed
from app.modules.assignments.models import Assignment
from app.modules.catalog.models import Moment, Project, ProjectStatus, ProjectTranslation
from app.modules.identity.models import Course, Enrollment, User
from app.modules.learning.models import Progress, ProgressState

# --- Cálculo de estado ----------------------------------------------------


def _estado(completados: int, total: int) -> str:
    if total and completados >= total:
        return "completed"
    if completados:
        return "in_progress"
    return "not_started"


def _puntualidad(estado: str, due_at: datetime | None) -> str:
    if due_at is None:
        return "no_due"
    if estado == "completed":
        return "done"
    return "late" if datetime.now(UTC) > due_at else "pending"


async def _moment_ids(db: AsyncSession, project_id: uuid.UUID) -> list[uuid.UUID]:
    return list(
        (
            await db.execute(select(Moment.id).where(Moment.project_id == project_id))
        ).scalars()
    )


async def _course(
    db: AsyncSession, course_id: uuid.UUID, institution_id: uuid.UUID
) -> Course:
    course = (
        await db.execute(
            select(Course).where(
                Course.id == course_id, Course.institution_id == institution_id
            )
        )
    ).scalar_one_or_none()
    if course is None:
        raise NotFound("Curso no encontrado")
    return course


async def _get(
    db: AsyncSession, assignment_id: uuid.UUID, institution_id: uuid.UUID
) -> Assignment:
    a = (
        await db.execute(
            select(Assignment).where(
                Assignment.id == assignment_id,
                Assignment.institution_id == institution_id,
            )
        )
    ).scalar_one_or_none()
    if a is None:
        raise NotFound("Asignación no encontrada")
    return a


async def _puede_editar(
    db: AsyncSession, tenant: TenantContext, course_id: uuid.UUID
) -> None:
    """Un docente sólo asigna en SUS cursos; editor/admin, en cualquiera de la
    institución."""
    if tenant.role in (Role.EDITOR, Role.ADMIN):
        return
    course = await _course(db, course_id, tenant.require_institution())
    if course.teacher_id != tenant.user_id:
        raise PermissionDenied("Sólo puedes asignar en tus cursos")


# --- Serialización -------------------------------------------------------


async def _titulos(
    db: AsyncSession, assignments: list[Assignment]
) -> tuple[dict[uuid.UUID, str], dict[uuid.UUID, str]]:
    course_ids = {a.course_id for a in assignments}
    project_ids = {a.project_id for a in assignments}
    cursos = (
        dict(
            (
                await db.execute(
                    select(Course.id, Course.name).where(Course.id.in_(course_ids))
                )
            ).all()
        )
        if course_ids
        else {}
    )
    proyectos = (
        dict(
            (
                await db.execute(
                    select(ProjectTranslation.project_id, ProjectTranslation.title).where(
                        ProjectTranslation.project_id.in_(project_ids),
                        ProjectTranslation.lang == "es",
                    )
                )
            ).all()
        )
        if project_ids
        else {}
    )
    return cursos, proyectos


def _serialize(a: Assignment, course_name: str, project_title: str) -> dict[str, Any]:
    return {
        "id": str(a.id),
        "course_id": str(a.course_id),
        "course_name": course_name,
        "project_id": str(a.project_id),
        "project_title": project_title,
        "title": a.title,
        "instructions": a.instructions,
        "due_at": a.due_at.isoformat() if a.due_at else None,
        "is_published": a.is_published,
        "created_at": a.created_at.isoformat(),
    }


# --- Docente ------------------------------------------------------------


async def list_for_staff(
    db: AsyncSession, tenant: TenantContext, *, course_id: uuid.UUID | None = None
) -> list[dict[str, Any]]:
    stmt = (
        select(Assignment)
        .where(Assignment.institution_id == tenant.require_institution())
        .order_by(
            Assignment.due_at.is_(None), Assignment.due_at, Assignment.created_at.desc()
        )
    )
    if course_id:
        stmt = stmt.where(Assignment.course_id == course_id)
    if tenant.role == Role.TEACHER:
        mis_cursos = (
            (
                await db.execute(
                    select(Course.id).where(
                        Course.institution_id == tenant.require_institution(),
                        Course.teacher_id == tenant.user_id,
                    )
                )
            )
            .scalars()
            .all()
        )
        stmt = stmt.where(Assignment.course_id.in_(mis_cursos or [uuid.uuid4()]))

    rows = (await db.execute(stmt)).scalars().all()
    cursos, proyectos = await _titulos(db, list(rows))
    return [
        _serialize(a, cursos.get(a.course_id, "—"), proyectos.get(a.project_id, "—"))
        for a in rows
    ]


async def get_one(
    db: AsyncSession, tenant: TenantContext, assignment_id: uuid.UUID
) -> dict[str, Any]:
    a = await _get(db, assignment_id, tenant.require_institution())
    cursos, proyectos = await _titulos(db, [a])
    return _serialize(a, cursos.get(a.course_id, "—"), proyectos.get(a.project_id, "—"))


async def create(
    db: AsyncSession,
    tenant: TenantContext,
    *,
    course_ids: list[uuid.UUID],
    project_id: uuid.UUID,
    title: str,
    instructions: str | None = None,
    due_at: datetime | None = None,
    is_published: bool = True,
) -> list[dict[str, Any]]:
    from app.modules.audit import service as audit
    from app.modules.notifications import service as notifications

    inst = tenant.require_institution()

    proyecto = (
        await db.execute(select(Project).where(Project.id == project_id))
    ).scalar_one_or_none()
    if proyecto is None:
        raise NotFound("Proyecto no encontrado")
    if proyecto.status != ProjectStatus.PUBLISHED:
        raise ValidationFailed("Sólo se pueden asignar proyectos publicados")

    creadas: list[Assignment] = []
    for cid in dict.fromkeys(course_ids):
        await _puede_editar(db, tenant, cid)
        a = Assignment(
            institution_id=inst,
            course_id=cid,
            project_id=project_id,
            assigned_by=tenant.user_id,
            title=title,
            instructions=instructions,
            due_at=due_at,
            is_published=is_published,
        )
        db.add(a)
        creadas.append(a)
    await db.flush()

    for a in creadas:
        await audit.record(
            db,
            institution_id=inst,
            actor_id=tenant.user_id,
            action="assignment.create",
            target_type="assignment",
            target_id=a.id,
            summary=f"Asignó '{title}' a un curso",
        )
        if a.is_published:
            alumnos = (
                (
                    await db.execute(
                        select(Enrollment.user_id).where(
                            Enrollment.course_id == a.course_id
                        )
                    )
                )
                .scalars()
                .all()
            )
            await notifications.notify_many(
                db,
                user_ids=alumnos,
                institution_id=inst,
                kind="assignment.new",
                title=f"Nueva tarea: {title}",
                body=(
                    f"Fecha de entrega: {due_at.date().isoformat()}"
                    if due_at
                    else "Sin fecha de entrega"
                ),
                link="/student/agenda",
            )

    cursos, proyectos = await _titulos(db, creadas)
    return [
        _serialize(a, cursos.get(a.course_id, "—"), proyectos.get(a.project_id, "—"))
        for a in creadas
    ]


async def update(
    db: AsyncSession,
    tenant: TenantContext,
    assignment_id: uuid.UUID,
    **campos: Any,
) -> dict[str, Any]:
    a = await _get(db, assignment_id, tenant.require_institution())
    await _puede_editar(db, tenant, a.course_id)
    for campo in ("title", "instructions", "due_at", "is_published"):
        if campo in campos:
            setattr(a, campo, campos[campo])
    await db.flush()
    return await get_one(db, tenant, assignment_id)


async def delete(
    db: AsyncSession, tenant: TenantContext, assignment_id: uuid.UUID
) -> None:
    a = await _get(db, assignment_id, tenant.require_institution())
    await _puede_editar(db, tenant, a.course_id)
    await db.delete(a)
    await db.flush()


async def tracking(
    db: AsyncSession, tenant: TenantContext, assignment_id: uuid.UUID
) -> dict[str, Any]:
    a = await _get(db, assignment_id, tenant.require_institution())
    await _puede_editar(db, tenant, a.course_id)

    mids = await _moment_ids(db, a.project_id)
    total = len(mids)

    alumnos = (
        (
            await db.execute(
                select(User)
                .join(Enrollment, Enrollment.user_id == User.id)
                .where(Enrollment.course_id == a.course_id)
                .order_by(User.full_name)
            )
        )
        .scalars()
        .all()
    )

    progresos: dict[uuid.UUID, int] = {}
    if mids and alumnos:
        filas = (
            await db.execute(
                select(Progress.user_id, Progress.moment_id).where(
                    Progress.user_id.in_([u.id for u in alumnos]),
                    Progress.moment_id.in_(mids),
                    Progress.state == ProgressState.COMPLETED,
                )
            )
        ).all()
        for uid, _mid in filas:
            progresos[uid] = progresos.get(uid, 0) + 1

    filas_out = []
    for u in alumnos:
        completos = progresos.get(u.id, 0)
        estado = _estado(completos, total)
        filas_out.append(
            {
                "user_id": str(u.id),
                "full_name": u.full_name,
                "completed_moments": completos,
                "total_moments": total,
                "status": estado,
                "timeliness": _puntualidad(estado, a.due_at),
            }
        )
    return {
        "assignment": {
            "id": str(a.id),
            "title": a.title,
            "due_at": a.due_at.isoformat() if a.due_at else None,
        },
        "rows": filas_out,
    }


# --- Estudiante --------------------------------------------------------


async def list_for_student(
    db: AsyncSession, tenant: TenantContext
) -> list[dict[str, Any]]:
    inst = tenant.require_institution()
    cursos = (
        (
            await db.execute(
                select(Enrollment.course_id).where(Enrollment.user_id == tenant.user_id)
            )
        )
        .scalars()
        .all()
    )
    if not cursos:
        return []

    rows = (
        (
            await db.execute(
                select(Assignment)
                .where(
                    Assignment.course_id.in_(cursos),
                    Assignment.institution_id == inst,
                    Assignment.is_published.is_(True),
                )
                .order_by(Assignment.due_at.is_(None), Assignment.due_at)
            )
        )
        .scalars()
        .all()
    )

    cursos_n, proyectos_n = await _titulos(db, list(rows))

    salida = []
    for a in rows:
        mids = await _moment_ids(db, a.project_id)
        completos = int(
            (
                await db.execute(
                    select(func.count(Progress.id)).where(
                        Progress.user_id == tenant.user_id,
                        Progress.moment_id.in_(mids or [uuid.uuid4()]),
                        Progress.state == ProgressState.COMPLETED,
                    )
                )
            ).scalar_one()
        )
        estado = _estado(completos, len(mids))
        salida.append(
            {
                **_serialize(
                    a,
                    cursos_n.get(a.course_id, "—"),
                    proyectos_n.get(a.project_id, "—"),
                ),
                "completed_moments": completos,
                "total_moments": len(mids),
                "status": estado,
                "timeliness": _puntualidad(estado, a.due_at),
            }
        )
    return salida

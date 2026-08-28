"""Camino de lectura del estudiante.

Sirve desde el snapshot publicado (arquitectura.md 3.1): UNA query, cacheable,
en vez de joins sobre 5 tablas en cada request.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import Role, TenantContext
from app.core.errors import NotFound, PermissionDenied
from app.modules.catalog.models import MOMENT_ORDER
from app.modules.identity.models import Course, Enrollment, User
from app.modules.learning.models import Progress, ProgressState
from app.modules.publishing.models import ProjectVersion
from app.modules.publishing.service import contenido_en


async def list_published_projects(
    db: AsyncSession, *, lang: str = "es", grade: str | None = None
) -> list[dict[str, Any]]:
    """N11: una sola query sobre `ProjectVersion`, sin join a `catalog`.

    `is_current=True` YA significa "publicado y vigente" — `publishing.publish`
    lo pone al publicar y `publishing.unpublish` lo quita al despublicar (ver
    su docstring). El snapshot lleva `grade`/`order` dentro, así que ni
    filtrar por grado ni ordenar necesitan la tabla `projects`.
    """
    stmt = select(ProjectVersion.snapshot).where(ProjectVersion.is_current.is_(True))
    if grade:
        stmt = stmt.where(ProjectVersion.snapshot["grade"].astext == grade)

    rows = (await db.execute(stmt)).scalars().all()

    fichas = []
    for snap in rows:
        servido, c = contenido_en(snap, lang)
        fichas.append(
            (
                snap.get("order", 0),
                {
                    "id": snap["id"],
                    "slug": snap["slug"],
                    "grade": snap["grade"],
                    "title": c["title"],
                    "summary": c.get("summary"),
                    # El idioma REALMENTE servido: puede no ser el pedido si
                    # el proyecto no esta traducido. La UI avisa con esto.
                    "lang": servido,
                },
            )
        )
    fichas.sort(key=lambda par: par[0])
    return [ficha for _, ficha in fichas]


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

    El filtro ocurre AQUÍ, en el servidor. Ocultarla en el cliente con CSS o un
    `if` no sirve: cualquier estudiante abre las DevTools y lee el JSON.
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

    # Progreso lineal (N5, decidido): solo aplica al estudiante. El docente
    # necesita poder entrar a cualquier momento para revisar o previsualizar.
    if not tenant.is_staff:
        await _exigir_momento_desbloqueado(db, tenant, project_id, moment_type)

    return {**serialize_moment_for(moment, tenant), "lang": servido}


# --- Progreso del estudiante (N5) -------------------------------------------


async def _ids_de_momentos(
    db: AsyncSession, project_id: uuid.UUID
) -> dict[str, uuid.UUID]:
    """`type -> moment_id` desde el snapshot publicado, no desde `catalog`."""
    snapshot = await get_project_snapshot(db, project_id)
    _, c = contenido_en(snapshot, "es")  # el tipo de momento no depende del idioma
    return {m["type"]: uuid.UUID(m["id"]) for m in c["moments"]}


async def progreso_de(
    db: AsyncSession, tenant: TenantContext, project_id: uuid.UUID
) -> dict[str, str]:
    """Mapa `moment_type -> state` para ESTE estudiante y proyecto."""
    ids_por_tipo = await _ids_de_momentos(db, project_id)
    if not ids_por_tipo:
        return {}

    filas = (
        await db.execute(
            select(Progress).where(
                Progress.user_id == tenant.user_id,
                Progress.moment_id.in_(ids_por_tipo.values()),
            )
        )
    ).scalars().all()
    estado_por_id = {p.moment_id: p.state for p in filas}
    return {
        tipo: estado_por_id.get(mid, ProgressState.NOT_STARTED)
        for tipo, mid in ids_por_tipo.items()
    }


async def _exigir_momento_desbloqueado(
    db: AsyncSession, tenant: TenantContext, project_id: uuid.UUID, moment_type: str
) -> None:
    """Un momento se desbloquea solo al completar el anterior. `intro` (el
    primero de `MOMENT_ORDER`) siempre está abierto."""
    if moment_type not in MOMENT_ORDER:
        return
    posicion = MOMENT_ORDER.index(moment_type)
    if posicion == 0:
        return

    anterior = MOMENT_ORDER[posicion - 1]
    progreso = await progreso_de(db, tenant, project_id)
    if progreso.get(anterior) != ProgressState.COMPLETED:
        raise PermissionDenied(
            f"Completa el momento '{anterior}' antes de entrar a '{moment_type}'"
        )


async def marcar_completado(
    db: AsyncSession, tenant: TenantContext, project_id: uuid.UUID, moment_type: str
) -> None:
    ids_por_tipo = await _ids_de_momentos(db, project_id)
    moment_id = ids_por_tipo.get(moment_type)
    if moment_id is None:
        raise NotFound(f"El momento '{moment_type}' no existe en este proyecto")

    fila = (
        await db.execute(
            select(Progress).where(
                Progress.user_id == tenant.user_id, Progress.moment_id == moment_id
            )
        )
    ).scalar_one_or_none()
    if fila is None:
        db.add(
            Progress(
                user_id=tenant.user_id,
                moment_id=moment_id,
                institution_id=tenant.require_institution(),
                state=ProgressState.COMPLETED,
                completed_at=datetime.now(UTC),
            )
        )
    else:
        fila.state = ProgressState.COMPLETED
        fila.completed_at = datetime.now(UTC)
    await db.flush()


# --- Panel docente (N6) ------------------------------------------------------


async def progreso_del_curso(
    db: AsyncSession,
    tenant: TenantContext,
    course_id: uuid.UUID,
    project_id: uuid.UUID,
) -> list[dict[str, Any]]:
    """Por estudiante matriculado, su progreso por momento de un proyecto.

    Lee `identity` (Course/Enrollment/User) porque el roster es suyo, y
    `Progress` porque es de aquí — `learning` puede leer otros módulos, nunca
    escribirlos (arquitectura.md §2).
    """
    curso = (
        await db.execute(
            select(Course).where(
                Course.id == course_id,
                Course.institution_id == tenant.require_institution(),
            )
        )
    ).scalar_one_or_none()
    if curso is None:
        raise NotFound("Curso no encontrado")

    estudiantes = (
        await db.execute(
            select(User)
            .join(Enrollment, Enrollment.user_id == User.id)
            .where(Enrollment.course_id == course_id)
            .order_by(User.full_name)
        )
    ).scalars().all()

    resultado = []
    for estudiante in estudiantes:
        tenant_del_alumno = TenantContext(
            user_id=estudiante.id,
            institution_id=estudiante.institution_id,
            role=Role.STUDENT,
        )
        resultado.append(
            {
                "user_id": str(estudiante.id),
                "full_name": estudiante.full_name,
                "progress": await progreso_de(db, tenant_del_alumno, project_id),
            }
        )
    return resultado

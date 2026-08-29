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
from app.modules.learning.models import BlockInteraction, Progress, ProgressState
from app.modules.media import service as media
from app.modules.publishing.models import ProjectVersion
from app.modules.publishing.service import contenido_en

# Tipos de bloque cuyo estado del alumno se persiste y se sirve con el momento.
INTERACTIVE_KINDS = ("checklist", "inline_quiz", "blockly")


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


async def resolver_media(db: AsyncSession, moments: list[dict[str, Any]]) -> None:
    """Anade `url` y `mime_type` a los bloques que referencian un asset.

    El snapshot guarda `media_asset_id` a secas, asi que sin esto un bloque de
    imagen, audio o video llega al cliente sin nada que pintar. Se resuelve
    AQUI, al servir, y no al publicar: la URL depende del bucket configurado, y
    congelarla en el snapshot dejaria el contenido ya publicado apuntando a la
    nada el dia que cambie.

    Una sola query para todos los bloques de todos los momentos que se pasen.
    Muta los diccionarios del bloque en el sitio, y es seguro: el snapshot se
    lee con `select(ProjectVersion.snapshot)`, un valor suelto que no cuelga de
    ninguna instancia del ORM, asi que la mutacion no vuelve a la base.
    """
    bloques = [b for m in moments for b in m.get("blocks", [])]
    ids = [
        uuid.UUID(b["media_asset_id"]) for b in bloques if b.get("media_asset_id")
    ]
    if not ids:
        return

    por_id = await media.urls_por_id(db, ids)
    for b in bloques:
        datos = por_id.get(b.get("media_asset_id") or "")
        # Un asset borrado deja el bloque sin URL en vez de tumbar el momento.
        b["url"] = datos["url"] if datos else None
        b["mime_type"] = datos["mime_type"] if datos else None
        b["duration_seconds"] = datos["duration_seconds"] if datos else None
        b["captions_vtt"] = datos["captions_vtt"] if datos else None


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


async def project_for(
    db: AsyncSession,
    snapshot: dict[str, Any],
    tenant: TenantContext,
    *,
    lang: str = "es",
) -> dict[str, Any]:
    """`serialize_project_for` + las URLs del media. Lo que sirve el router.

    La version sincrona se conserva porque `catalog` la reutiliza para la
    previsualizacion del editor y las pruebas unitarias la ejercitan sin base
    de datos; el acceso a media es lo unico que necesita una sesion.
    """
    salida = serialize_project_for(snapshot, tenant, lang=lang)
    await resolver_media(db, salida["moments"])
    return salida


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

    salida = {**serialize_moment_for(moment, tenant), "lang": servido}
    await resolver_media(db, [salida])
    if not tenant.is_staff:
        await _adjuntar_interacciones(db, tenant, [salida])
    return salida


async def _adjuntar_interacciones(
    db: AsyncSession, tenant: TenantContext, moments: list[dict[str, Any]]
) -> None:
    """Pega en cada bloque interactivo el estado guardado de ESTE alumno.

    Muta los dicts en el sitio; seguro porque cuelgan de un snapshot leído como
    valor suelto, no de una instancia del ORM (igual que `resolver_media`)."""
    bloques = {
        b["id"]: b
        for m in moments
        for b in m.get("blocks", [])
        if b.get("kind") in INTERACTIVE_KINDS
    }
    if not bloques:
        return

    ids = [uuid.UUID(bid) for bid in bloques]
    filas = (
        await db.execute(
            select(BlockInteraction.block_id, BlockInteraction.state).where(
                BlockInteraction.user_id == tenant.user_id,
                BlockInteraction.block_id.in_(ids),
            )
        )
    ).all()
    estado = {str(bid): st for bid, st in filas}
    for bid, bloque in bloques.items():
        bloque["interaction"] = estado.get(bid)


async def guardar_interaccion(
    db: AsyncSession,
    tenant: TenantContext,
    block_id: uuid.UUID,
    state: dict[str, Any],
) -> dict[str, Any]:
    """Upsert del estado del alumno en un bloque interactivo. No valida contra
    el contenido: es un borrador que no cuenta para nada (ver el docstring del
    modelo)."""
    fila = (
        await db.execute(
            select(BlockInteraction).where(
                BlockInteraction.user_id == tenant.user_id,
                BlockInteraction.block_id == block_id,
            )
        )
    ).scalar_one_or_none()
    if fila is None:
        fila = BlockInteraction(
            user_id=tenant.user_id,
            block_id=block_id,
            institution_id=tenant.require_institution(),
            state=state,
        )
        db.add(fila)
    else:
        fila.state = state
    await db.flush()
    return {"block_id": str(block_id), "state": state}


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

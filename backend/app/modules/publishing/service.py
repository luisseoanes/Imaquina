"""Publicación: valida, versiona y dispara el reindexado.

El snapshot que se genera aquí es la fuente de lectura de los estudiantes
(arquitectura.md 3.1) y el punto de rollback (3.x). Un solo trabajo, dos usos.
"""

import uuid
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFound, ValidationFailed
from app.modules.catalog.models import (
    MOMENT_ORDER,
    Moment,
    Project,
    ProjectStatus,
)
from app.modules.publishing.models import ProjectVersion

LANGS = ("es", "en")


async def _load_full(db: AsyncSession, project_id: uuid.UUID) -> Project:
    stmt = (
        select(Project)
        .where(Project.id == project_id)
        .options(
            selectinload(Project.translations),
            selectinload(Project.moments)
            .selectinload(Moment.blocks),
            selectinload(Project.moments).selectinload(Moment.translations),
        )
    )
    project = (await db.execute(stmt)).scalar_one_or_none()
    if project is None:
        raise NotFound("Proyecto no encontrado")
    return project


def validate_for_publish(project: Project, lang: str = "es") -> list[str]:
    """Se valida al PUBLICAR, no al escribir.

    El editor puede guardar a medias; la completitud sólo se exige aquí.
    """
    problems: list[str] = []

    if not any(t.lang == lang for t in project.translations):
        problems.append(f"Falta el título del proyecto en '{lang}'")

    present = {m.type for m in project.moments}
    for expected in MOMENT_ORDER:
        if expected not in present:
            problems.append(f"Falta el momento '{expected}'")

    for moment in project.moments:
        tr = next((t for t in moment.translations if t.lang == lang), None)
        if tr is None:
            problems.append(f"El momento '{moment.type}' no tiene título en '{lang}'")
        if not moment.blocks:
            problems.append(f"El momento '{moment.type}' no tiene contenido")

    return problems


def build_snapshot(project: Project, lang: str = "es") -> dict[str, Any]:
    """Serializa el proyecto completo.

    Incluye `teacher_note`: el snapshot es la fuente de verdad completa.
    El filtrado por rol ocurre al SERVIR (learning/service.py), nunca aquí
    — así un mismo snapshot sirve a docentes y estudiantes.
    """
    ptr = next((t for t in project.translations if t.lang == lang), None)

    return {
        "id": str(project.id),
        "slug": project.slug,
        "grade": project.grade,
        "kit": project.kit,
        "lang": lang,
        "title": ptr.title if ptr else project.slug,
        "summary": ptr.summary if ptr else None,
        "moments": [
            {
                "id": str(m.id),
                "type": m.type,
                "order": m.order,
                "title": _tr(m.translations, lang, "title", default=m.type),
                "teacher_note": _tr(m.translations, lang, "teacher_note"),
                "chatbot_opening_prompt": _tr(
                    m.translations, lang, "chatbot_opening_prompt"
                ),
                "blocks": [
                    {
                        "id": str(b.id),
                        "kind": b.kind,
                        "order": b.order,
                        "media_asset_id": str(b.media_asset_id)
                        if b.media_asset_id
                        else None,
                        "body": _tr(b.translations, lang, "body"),
                        "caption": _tr(b.translations, lang, "caption"),
                        "alt_text": _tr(b.translations, lang, "alt_text"),
                    }
                    for b in m.blocks
                ],
            }
            for m in sorted(project.moments, key=lambda x: x.order)
        ],
    }


def _tr(translations: list, lang: str, attr: str, default: Any = None) -> Any:
    row = next((t for t in translations if t.lang == lang), None)
    return getattr(row, attr, default) if row else default


async def check_publishable(
    db: AsyncSession, project_id: uuid.UUID, lang: str = "es"
) -> list[str]:
    """Lista de problemas que impiden publicar. Vacía = listo."""
    project = await _load_full(db, project_id)
    return validate_for_publish(project, lang)


async def publish(
    db: AsyncSession,
    project_id: uuid.UUID,
    *,
    published_by: uuid.UUID,
    lang: str = "es",
) -> ProjectVersion:
    project = await _load_full(db, project_id)

    problems = validate_for_publish(project, lang)
    if problems:
        raise ValidationFailed("; ".join(problems))

    last = (
        await db.execute(
            select(ProjectVersion.version)
            .where(ProjectVersion.project_id == project_id)
            .order_by(ProjectVersion.version.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    await db.execute(
        update(ProjectVersion)
        .where(ProjectVersion.project_id == project_id)
        .values(is_current=False)
    )

    version = ProjectVersion(
        project_id=project_id,
        version=(last or 0) + 1,
        snapshot=build_snapshot(project, lang),
        published_by=published_by,
        is_current=True,
    )
    db.add(version)
    project.status = ProjectStatus.PUBLISHED
    await db.flush()
    return version


async def rollback(
    db: AsyncSession, project_id: uuid.UUID, target_version: int
) -> ProjectVersion:
    """Un clic. Con contenido en manos no técnicas, esto no es opcional."""
    target = (
        await db.execute(
            select(ProjectVersion).where(
                ProjectVersion.project_id == project_id,
                ProjectVersion.version == target_version,
            )
        )
    ).scalar_one_or_none()
    if target is None:
        raise NotFound(f"No existe la versión {target_version}")

    await db.execute(
        update(ProjectVersion)
        .where(ProjectVersion.project_id == project_id)
        .values(is_current=False)
    )
    target.is_current = True
    await db.flush()
    return target

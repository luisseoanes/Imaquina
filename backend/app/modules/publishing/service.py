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
    BlockKind,
    ContentBlock,
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
            # La cadena llega hasta las traducciones del BLOQUE: build_snapshot
            # las lee, y en async un lazy load aqui revienta con MissingGreenlet.
            selectinload(Project.moments)
            .selectinload(Moment.blocks)
            .selectinload(ContentBlock.translations),
            selectinload(Project.moments).selectinload(Moment.translations),
        )
        # populate_existing: si el proyecto ya esta en el identity map con sus
        # colecciones cargadas —lo normal si se acaba de editar en la misma
        # sesion— SQLAlchemy devuelve las VIEJAS. Sin esto, publicar justo
        # despues de anadir un bloque serializaria un snapshot desactualizado.
        .execution_options(populate_existing=True)
    )
    project = (await db.execute(stmt)).scalar_one_or_none()
    if project is None:
        raise NotFound("Proyecto no encontrado")
    return project


def _problemas_de_estructura(project: Project) -> list[str]:
    """Lo que no depende del idioma: que esten los seis momentos y con algo."""
    problems: list[str] = []

    present = {m.type for m in project.moments}
    for expected in MOMENT_ORDER:
        if expected not in present:
            problems.append(f"Falta el momento '{expected}'")

    for moment in project.moments:
        if not moment.blocks:
            problems.append(f"El momento '{moment.type}' no tiene contenido")

    return problems


def _falta_en_el_bloque(block: Any, lang: str) -> str | None:
    """Que texto exige cada tipo de bloque para darse por traducido.

    Un bloque de texto sin cuerpo no es contenido; una imagen sin `alt_text`
    no es accesible (y el `alt` es obligatorio en el editor). Del resto no se
    exige texto: un video puede no llevar pie.
    """
    tr = next((t for t in block.translations if t.lang == lang), None)

    if block.kind == BlockKind.TEXT:
        return "texto" if not (tr and (tr.body or "").strip()) else None
    if block.kind == BlockKind.IMAGE:
        return "alt_text" if not (tr and (tr.alt_text or "").strip()) else None
    if block.kind == BlockKind.EMBED:
        # Un embed sin fuente no pinta nada. La fuente puede venir en `config`
        # (proveedor + src, el camino nuevo) o, como antes, escrita a mano en
        # `body`; con cualquiera de las dos el bloque es servible.
        config = getattr(block, "config", None) or {}
        tiene_config = bool(config.get("provider") and config.get("src"))
        tiene_body = bool(tr and (tr.body or "").strip())
        return None if (tiene_config or tiene_body) else "fuente del embed"
    return None


def problemas_de_idioma(project: Project, lang: str) -> list[str]:
    """Lo que falta para poder servir el proyecto en ESE idioma."""
    problems: list[str] = []

    # Ojo: se exige titulo NO VACIO, no que exista la fila. Guardar solo la
    # guia docente crea la traduccion con el titulo en blanco, y eso no es
    # tenerlo traducido.
    if not (_tr(project.translations, lang, "title") or "").strip():
        problems.append(f"Falta el título del proyecto en '{lang}'")

    for moment in project.moments:
        if not (_tr(moment.translations, lang, "title") or "").strip():
            problems.append(f"El momento '{moment.type}' no tiene título en '{lang}'")

        # Sin esto un idioma entraba al snapshot con los bloques vacios y el
        # estudiante veia el momento en blanco.
        for orden, block in enumerate(sorted(moment.blocks, key=lambda b: b.order)):
            if falta := _falta_en_el_bloque(block, lang):
                problems.append(
                    f"El bloque {orden + 1} de '{moment.type}' no tiene "
                    f"{falta} en '{lang}'"
                )

    return problems


def validate_for_publish(project: Project, lang: str = "es") -> list[str]:
    """Se valida al PUBLICAR, no al escribir.

    El editor puede guardar a medias; la completitud sólo se exige aquí.
    """
    return _problemas_de_estructura(project) + problemas_de_idioma(project, lang)


def _tr(translations: list, lang: str, attr: str, default: Any = None) -> Any:
    row = next((t for t in translations if t.lang == lang), None)
    return getattr(row, attr, default) if row else default


def _contenido(project: Project, lang: str) -> dict[str, Any]:
    """El proyecto en UN idioma: titulo, resumen y los seis momentos."""
    ptr = next((t for t in project.translations if t.lang == lang), None)

    return {
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
                        "config": getattr(b, "config", None) or {},
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


def build_snapshot(project: Project) -> dict[str, Any]:
    """Serializa el proyecto con TODOS los idiomas que esten completos.

    Un snapshot por idioma no funciona: solo puede haber una version
    `is_current`, asi que publicar en ingles sustituiria a la española y la
    plataforma bilingue (R6) se rompe. Una version = una publicacion del
    proyecto entero, con las traducciones que haya.

    Un idioma entra solo si pasa la misma validacion que el principal: media
    traduccion serviria contenido a medias al estudiante. Publicar solo en ES
    es un caso normal, no un error.

    Incluye `teacher_note`: el snapshot es la fuente de verdad completa y el
    filtrado por rol ocurre al SERVIR (learning/service.py), nunca aqui.
    """
    # Solo la completitud de la TRADUCCION decide si un idioma entra. La
    # estructura no depende del idioma y `publish` ya la ha exigido.
    langs = [lang for lang in LANGS if not problemas_de_idioma(project, lang)]

    return {
        "id": str(project.id),
        "slug": project.slug,
        "grade": project.grade,
        "kit": project.kit,
        # N11: el listado del estudiante ordena por esto sin tener que hacer
        # join contra `Project` -- el snapshot ya lleva todo lo que hace falta.
        "order": project.order,
        "langs": langs,
        "content": {lang: _contenido(project, lang) for lang in langs},
    }


def contenido_en(snapshot: dict[str, Any], lang: str) -> tuple[str, dict[str, Any]]:
    """(idioma servido, contenido) para el idioma pedido.

    Si el proyecto no esta traducido a ese idioma se sirve el que haya, en vez
    de un 404: mejor ver el momento en español que no verlo. El idioma servido
    se devuelve para que la UI pueda avisar de que no esta traducido.
    """
    disponibles = snapshot.get("langs") or []
    servido = lang if lang in disponibles else next(iter(disponibles), None)
    if servido is None:
        raise NotFound("El proyecto no tiene contenido publicado en ningun idioma")
    return servido, snapshot["content"][servido]


async def cargar_para_validar(db: AsyncSession, project_id: uuid.UUID) -> Project:
    """El proyecto con todo lo que la validacion necesita mirar.

    Publico porque el Studio lo usa para pintar el estado de traduccion con el
    mismo criterio con el que se decide publicar.
    """
    return await _load_full(db, project_id)


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
        snapshot=build_snapshot(project),
        published_by=published_by,
        is_current=True,
    )
    db.add(version)
    project.status = ProjectStatus.PUBLISHED
    await db.flush()
    return version


async def unpublish(db: AsyncSession, project_id: uuid.UUID) -> Project:
    """S18: la única acción que faltaba para completar el ciclo de `status`.

    La fila de `ProjectVersion` NO se borra — el historial de snapshots se
    conserva por si se vuelve a publicar — pero deja de ser `is_current`
    (N11: el camino de lectura del estudiante filtra solo por eso, sin join a
    `Project.status`; si se dejara `is_current=True`, el proyecto seguiría
    pareciendo publicado). Un republicar reconstruye el snapshot desde cero de
    todas formas, así que no se pierde nada al apagar el flag.
    """
    project = (
        await db.execute(select(Project).where(Project.id == project_id))
    ).scalar_one_or_none()
    if project is None:
        raise NotFound("Proyecto no encontrado")

    await db.execute(
        update(ProjectVersion)
        .where(
            ProjectVersion.project_id == project_id,
            ProjectVersion.is_current.is_(True),
        )
        .values(is_current=False)
    )
    project.status = ProjectStatus.DRAFT
    await db.flush()
    return project


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

"""Worker ARQ. Arrancar con:  arq app.workers.worker.WorkerSettings"""

import uuid

from arq import cron
from arq.connections import RedisSettings

from app.core.config import settings
from app.db.session import SessionLocal


def _texto_indexable(block: dict, lang: str) -> str:
    """El texto de un bloque que el RAG debe conocer, sea cual sea su tipo.

    Para texto/imagen/embed es `body`; para los interactivos hay que sacar los
    pasos de la checklist y los enunciados del quiz de `config`, o el chat no
    sabría responder sobre ellos."""

    def _t(mapa: object) -> str:
        return (mapa.get(lang) or "").strip() if isinstance(mapa, dict) else ""

    kind = block.get("kind")
    config = block.get("config") or {}
    if kind == "checklist":
        return "\n".join(_t(it.get("text")) for it in config.get("items") or [])
    if kind == "inline_quiz":
        trozos: list[str] = []
        for q in config.get("questions") or []:
            trozos.append(_t(q.get("prompt")))
            trozos += [_t(o.get("text")) for o in q.get("options") or []]
        return "\n".join(p for p in trozos if p)
    if kind == "video_chapters":
        return "\n".join(_t(c.get("label")) for c in config.get("chapters") or [])
    return (block.get("body") or "").strip()


async def reindex_project(ctx: dict, project_id: str) -> dict:
    """IDEMPOTENTE: borra los chunks del proyecto y los regenera.

    Se va a reintentar, asi que nunca acumular.
    """
    from sqlalchemy import delete, select

    from app.modules.assistant.models import DocumentChunk
    from app.modules.assistant.provider import get_embedder
    from app.modules.publishing.models import ProjectVersion

    pid = uuid.UUID(project_id)
    async with SessionLocal() as db:
        await db.execute(delete(DocumentChunk).where(DocumentChunk.project_id == pid))

        snapshot = (
            await db.execute(
                select(ProjectVersion.snapshot).where(
                    ProjectVersion.project_id == pid,
                    ProjectVersion.is_current.is_(True),
                )
            )
        ).scalar_one_or_none()

        if snapshot is None:
            await db.commit()
            return {"project_id": project_id, "chunks": 0, "reason": "sin publicar"}

        # Un chunk por idioma: el snapshot lleva todas las traducciones y el
        # chat responde en el idioma del estudiante. Indexar solo uno dejaba
        # al que pregunta en ingles recuperando contexto en español.
        pendientes: list[tuple[uuid.UUID, str, str]] = []
        for lang in snapshot.get("langs", []):
            for moment in snapshot["content"][lang]["moments"]:
                for block in moment["blocks"]:
                    body = _texto_indexable(block, lang)
                    if not body:
                        continue
                    pendientes.append((uuid.UUID(moment["id"]), lang, body))

        # Sin GEMINI_API_KEY, get_embedder() es None: se mantiene el
        # placeholder de ceros -- coherente con que sin key la recuperacion
        # tampoco se activa nunca en assistant.service.ask.
        embedder = get_embedder()
        if embedder and pendientes:
            vectores = await embedder.embed(
                [body for _, _, body in pendientes], task_type="RETRIEVAL_DOCUMENT"
            )
        else:
            vectores = [[0.0] * settings.EMBEDDING_DIM for _ in pendientes]

        for (moment_id, lang, body), vector in zip(pendientes, vectores, strict=True):
            db.add(
                DocumentChunk(
                    project_id=pid,
                    moment_id=moment_id,
                    lang=lang,
                    content=body,
                    embedding=vector,
                )
            )

        await db.commit()
    return {"project_id": project_id, "chunks": len(pendientes)}


async def export_results(ctx: dict, assessment_id: str, requested_by: str) -> dict:
    """Genera el XLSX del tablero docente (R10, A6).

    Sube a una key determinista (`exports/{assessment_id}.xlsx`): un segundo
    export sobre la misma evaluación simplemente sobreescribe, no acumula
    ficheros viejos. `service.export_url` hace `head_object` sobre esa misma
    key para saber si ya está listo.
    """
    from io import BytesIO

    import boto3
    from openpyxl import Workbook
    from sqlalchemy import select

    from app.modules.assessment.models import Assessment, Attempt
    from app.modules.identity.models import User

    aid = uuid.UUID(assessment_id)
    async with SessionLocal() as db:
        assessment = (
            await db.execute(select(Assessment).where(Assessment.id == aid))
        ).scalar_one_or_none()
        if assessment is None:
            return {"assessment_id": assessment_id, "status": "no encontrada"}

        intentos = (
            (await db.execute(select(Attempt).where(Attempt.assessment_id == aid)))
            .scalars()
            .all()
        )
        estudiantes = {
            u.id: u.full_name
            for u in (
                await db.execute(
                    select(User).where(User.id.in_([a.student_id for a in intentos]))
                )
            )
            .scalars()
            .all()
        }

        libro = Workbook()
        hoja = libro.active
        hoja.title = "Resultados"
        hoja.append(["Estudiante", "Equipo", "Estado", "Puntaje", "Enviado"])
        for intento in intentos:
            hoja.append(
                [
                    estudiantes.get(intento.student_id, str(intento.student_id)),
                    intento.team_label or "",
                    intento.status,
                    intento.score,
                    intento.submitted_at.isoformat() if intento.submitted_at else "",
                ]
            )

        buffer = BytesIO()
        libro.save(buffer)

    s3 = boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    )
    key = f"exports/{assessment_id}.xlsx"
    s3.put_object(Bucket=settings.S3_BUCKET, Key=key, Body=buffer.getvalue())
    return {"assessment_id": assessment_id, "status": "listo", "s3_key": key}


async def delete_orphaned_media(ctx: dict, s3_key: str) -> dict:
    """IDEMPOTENTE: borra el objeto del bucket solo si ya no hay ninguna fila
    de `MediaAsset` con esta `s3_key` (S19).

    `media.service.borrar` da de baja el registro sin tocar el bucket -- el
    fichero queda huerfano hasta que este trabajo lo limpia. La comprobacion
    de nuevo aqui es la guarda contra condiciones de carrera; `delete_object`
    de S3 ya es idempotente si el objeto no existe.
    """
    import boto3
    from sqlalchemy import select

    from app.modules.media.models import MediaAsset

    async with SessionLocal() as db:
        sigue_referenciado = (
            await db.execute(select(MediaAsset.id).where(MediaAsset.s3_key == s3_key))
        ).scalar_one_or_none()

    if sigue_referenciado is not None:
        return {"s3_key": s3_key, "borrado": False, "razon": "en uso"}

    s3 = boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    )
    s3.delete_object(Bucket=settings.S3_BUCKET, Key=s3_key)
    return {"s3_key": s3_key, "borrado": True}


async def purge_old_chat_history(ctx: dict) -> dict:
    """C4: retención acotada -- son datos de menores (Ley 1581). Borra de
    verdad, no marca: `ChatMessage` cuelga de `ChatSession` con CASCADE, así
    que borrar la sesión se lleva sus mensajes."""
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import delete

    from app.modules.assistant.models import ChatSession

    limite = datetime.now(UTC) - timedelta(days=settings.CHAT_RETENTION_DAYS)
    async with SessionLocal() as db:
        resultado = await db.execute(
            delete(ChatSession).where(ChatSession.created_at < limite)
        )
        await db.commit()
    return {"borrados": resultado.rowcount}


async def notify_due_assignments(ctx: dict) -> dict:
    """Avisa a los alumnos de las tareas que vencen en las próximas 48 h y que
    aún no han completado. Idempotente por día: no re-notifica lo ya avisado
    esa misma jornada (misma `kind` + `link` + creada hoy)."""
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import select

    from app.modules.assignments.models import Assignment
    from app.modules.identity.models import Enrollment
    from app.modules.notifications import service as notifications
    from app.modules.notifications.models import Notification

    ahora = datetime.now(UTC)
    limite = ahora + timedelta(hours=48)
    avisados = 0
    async with SessionLocal() as db:
        tareas = (
            (
                await db.execute(
                    select(Assignment).where(
                        Assignment.is_published.is_(True),
                        Assignment.due_at.is_not(None),
                        Assignment.due_at > ahora,
                        Assignment.due_at <= limite,
                    )
                )
            )
            .scalars()
            .all()
        )
        for a in tareas:
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
            ya = set(
                (
                    await db.execute(
                        select(Notification.user_id).where(
                            Notification.kind == "assignment.due_soon",
                            Notification.created_at
                            >= ahora.replace(hour=0, minute=0, second=0, microsecond=0),
                        )
                    )
                ).scalars()
            )
            pendientes = [u for u in alumnos if u not in ya]
            if pendientes:
                await notifications.notify_many(
                    db,
                    user_ids=pendientes,
                    institution_id=a.institution_id,
                    kind="assignment.due_soon",
                    title=f"Vence pronto: {a.title}",
                    body=f"Entrega antes del {a.due_at.date().isoformat()}.",
                    link="/student/agenda",
                )
                avisados += len(pendientes)
        await db.commit()
    return {"avisos": avisados}


async def notify_expiring_licenses(ctx: dict) -> dict:
    """Avisa a los administradores de cada institución cuya licencia vence en
    los próximos 14 días."""
    from datetime import date, timedelta

    from sqlalchemy import select

    from app.modules.identity.models import License, User
    from app.modules.notifications import service as notifications

    limite = date.today() + timedelta(days=14)
    avisos = 0
    async with SessionLocal() as db:
        licencias = (
            (
                await db.execute(
                    select(License).where(
                        License.valid_to >= date.today(), License.valid_to <= limite
                    )
                )
            )
            .scalars()
            .all()
        )
        for lic in licencias:
            admins = (
                (
                    await db.execute(
                        select(User.id).where(
                            User.institution_id == lic.institution_id,
                            User.role == "admin",
                            User.is_active.is_(True),
                        )
                    )
                )
                .scalars()
                .all()
            )
            await notifications.notify_many(
                db,
                user_ids=admins,
                institution_id=lic.institution_id,
                kind="license.expiring",
                title="La licencia vence pronto",
                body=(
                    "La licencia de la institución vence el "
                    f"{lic.valid_to.isoformat()}."
                ),
                link="/admin/settings",
            )
            avisos += len(admins)
        await db.commit()
    return {"avisos": avisos}


class WorkerSettings:
    functions = [reindex_project, export_results, delete_orphaned_media]
    # Primer uso de cron en el repo: antes todo era encolado al vuelo desde
    # un router (publicar, borrar media). Esto es la excepción -- nadie
    # dispara "purgar historial viejo" a mano, tiene que ser periódico.
    cron_jobs = [
        cron(purge_old_chat_history, hour={3}, minute=0),
        cron(notify_due_assignments, hour={6}, minute=0),
        cron(notify_expiring_licenses, hour={6}, minute=15),
    ]
    redis_settings = RedisSettings.from_dsn(str(settings.REDIS_URL))
    max_jobs = 10
    job_timeout = 300

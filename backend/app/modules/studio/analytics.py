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

from app.modules.assessment.models import (
    Answer,
    Assessment,
    Attempt,
    AttemptStatus,
    Question,
    QuestionTranslation,
)
from app.modules.assistant.models import ChatMessage, ChatSession
from app.modules.catalog.models import Moment, MomentTranslation, Project, ProjectStatus
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


async def item_analysis(
    db: AsyncSession, institution_id: uuid.UUID
) -> list[dict[str, Any]]:
    """Por pregunta: índice de dificultad (proporción de acierto) y de
    discriminación (D = %acierto del tercio alto − %acierto del tercio bajo,
    partiendo por la nota del intento).

    Una abierta se cuenta como acertada si el docente le dio ≥ la mitad de sus
    puntos. Los intentos sin calificar del todo se ignoran."""
    filas = (
        await db.execute(
            select(
                Answer.attempt_id,
                Attempt.score,
                Answer.question_id,
                Answer.is_correct,
                Answer.teacher_score,
                Question.points,
            )
            .join(Attempt, Attempt.id == Answer.attempt_id)
            .join(Question, Question.id == Answer.question_id)
            .where(
                Attempt.institution_id == institution_id,
                Attempt.status == AttemptStatus.GRADED,
            )
        )
    ).all()

    # correctness por (attempt, question)
    por_pregunta: dict[uuid.UUID, list[tuple[float, int]]] = {}
    puntaje_intento: dict[uuid.UUID, float] = {}
    for aid, score, qid, is_correct, tscore, points in filas:
        puntaje_intento[aid] = float(score or 0.0)
        if is_correct is not None:
            acierto = 1 if is_correct else 0
        elif tscore is not None and points:
            acierto = 1 if tscore >= points / 2 else 0
        else:
            continue
        por_pregunta.setdefault(qid, []).append((aid, acierto))

    if not por_pregunta:
        return []

    intentos_ordenados = sorted(puntaje_intento, key=lambda a: puntaje_intento[a])
    corte = max(1, len(intentos_ordenados) // 3)
    bajo = set(intentos_ordenados[:corte])
    alto = set(intentos_ordenados[-corte:])

    prompts = dict(
        (
            await db.execute(
                select(QuestionTranslation.question_id, QuestionTranslation.prompt).where(
                    QuestionTranslation.question_id.in_(por_pregunta.keys()),
                    QuestionTranslation.lang == "es",
                )
            )
        ).all()
    )
    kinds = dict(
        (
            await db.execute(
                select(Question.id, Question.kind).where(
                    Question.id.in_(por_pregunta.keys())
                )
            )
        ).all()
    )

    salida = []
    for qid, respuestas in por_pregunta.items():
        n = len(respuestas)
        dificultad = sum(a for _, a in respuestas) / n
        a_alto = [a for aid, a in respuestas if aid in alto]
        a_bajo = [a for aid, a in respuestas if aid in bajo]
        disc = (
            (sum(a_alto) / len(a_alto) - sum(a_bajo) / len(a_bajo))
            if a_alto and a_bajo
            else None
        )
        salida.append(
            {
                "question_id": str(qid),
                "prompt": prompts.get(qid),
                "kind": kinds.get(qid),
                "n": n,
                "difficulty": round(dificultad, 2),
                "discrimination": round(disc, 2) if disc is not None else None,
            }
        )
    salida.sort(key=lambda r: (r["discrimination"] is None, r["discrimination"] or 0))
    return salida


async def moment_dropoff(
    db: AsyncSession, institution_id: uuid.UUID
) -> list[dict[str, Any]]:
    """Por momento: cuántos alumnos entraron (tienen fila de `Progress`) frente
    a cuántos lo completaron. El escalón donde más gente cae es dónde revisar
    el contenido."""
    filas = (
        await db.execute(
            select(
                Progress.moment_id,
                Moment.project_id,
                Moment.type,
                func.count(Progress.id),
                func.count(Progress.id).filter(
                    Progress.state == ProgressState.COMPLETED
                ),
            )
            .join(Moment, Moment.id == Progress.moment_id)
            .where(Progress.institution_id == institution_id)
            .group_by(Progress.moment_id, Moment.project_id, Moment.type)
        )
    ).all()
    titulos = dict(
        (
            await db.execute(
                select(MomentTranslation.moment_id, MomentTranslation.title).where(
                    MomentTranslation.lang == "es"
                )
            )
        ).all()
    )
    salida = [
        {
            "moment_id": str(mid),
            "project_id": str(pid),
            "type": tipo,
            "title": titulos.get(mid),
            "entered": int(entered),
            "completed": int(completed),
            "dropoff": int(entered) - int(completed),
        }
        for mid, pid, tipo, entered, completed in filas
    ]
    salida.sort(key=lambda r: r["dropoff"], reverse=True)
    return salida


async def chatbot_confusion(
    db: AsyncSession, institution_id: uuid.UUID
) -> list[dict[str, Any]]:
    """Por momento: cuántas preguntas le hacen al chat y qué proporción de
    ellas dispara el guardrail. Un momento que dispara muchas preguntas es un
    candidato a "mejora este contenido"."""
    filas = (
        await db.execute(
            select(
                ChatSession.moment_id,
                func.count(ChatMessage.id),
                func.count(ChatMessage.id).filter(
                    ChatMessage.was_redirected.is_(True)
                ),
            )
            .join(ChatMessage, ChatMessage.session_id == ChatSession.id)
            .where(
                ChatSession.institution_id == institution_id,
                ChatMessage.role == "user",
                ChatSession.moment_id.is_not(None),
            )
            .group_by(ChatSession.moment_id)
        )
    ).all()
    titulos = dict(
        (
            await db.execute(
                select(MomentTranslation.moment_id, MomentTranslation.title).where(
                    MomentTranslation.lang == "es"
                )
            )
        ).all()
    )
    salida = [
        {
            "moment_id": str(mid),
            "title": titulos.get(mid),
            "questions": int(total),
            "redirected": int(redir),
            "redirect_rate": round(int(redir) / int(total), 2) if total else 0,
        }
        for mid, total, redir in filas
    ]
    salida.sort(key=lambda r: r["questions"], reverse=True)
    return salida


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

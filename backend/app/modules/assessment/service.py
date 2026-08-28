"""Evaluación (R10, F3): constructor de preguntas, intentos y calificación.

Autoría (`Author`, dentro del Studio) y camino del estudiante (`Tenant`) viven
en el mismo servicio a propósito: comparten el mismo árbol de modelos y no hay
snapshot publicado de por medio para la evaluación -- a diferencia de
`catalog`/`learning`, aquí no existe la separación lectura/escritura.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import TenantContext
from app.core.errors import Conflict, NotFound, ValidationFailed
from app.modules.assessment.models import (
    Answer,
    Assessment,
    Attempt,
    AttemptStatus,
    Choice,
    ChoiceTranslation,
    Question,
    QuestionKind,
    QuestionTranslation,
)

TOLERANCIA_NUMERICA = 1e-6


# --- Autoría (A1) ------------------------------------------------------------


def _serializar_choice(choice: Choice, lang: str) -> dict[str, Any]:
    tr = next((t for t in choice.translations if t.lang == lang), None)
    return {
        "id": str(choice.id),
        "order": choice.order,
        "is_correct": choice.is_correct,
        "label": tr.label if tr else None,
    }


def _serializar_question(question: Question, lang: str) -> dict[str, Any]:
    tr = next((t for t in question.translations if t.lang == lang), None)
    return {
        "id": str(question.id),
        "kind": question.kind,
        "order": question.order,
        "points": question.points,
        "correct_numeric": question.correct_numeric,
        "prompt": tr.prompt if tr else None,
        "choices": [
            _serializar_choice(c, lang)
            for c in sorted(question.choices, key=lambda c: c.order)
        ],
    }


def _serializar_assessment(assessment: Assessment, lang: str) -> dict[str, Any]:
    return {
        "id": str(assessment.id),
        "moment_id": str(assessment.moment_id),
        "max_attempts": assessment.max_attempts,
        "pass_score": assessment.pass_score,
        "team_mode": assessment.team_mode,
        "questions": [
            _serializar_question(q, lang)
            for q in sorted(assessment.questions, key=lambda q: q.order)
        ],
    }


async def _get_full(db: AsyncSession, assessment_id: uuid.UUID) -> Assessment:
    assessment = (
        await db.execute(
            select(Assessment)
            .where(Assessment.id == assessment_id)
            .options(
                selectinload(Assessment.questions)
                .selectinload(Question.choices)
                .selectinload(Choice.translations),
                selectinload(Assessment.questions).selectinload(Question.translations),
            )
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if assessment is None:
        raise NotFound("Evaluación no encontrada")
    return assessment


async def ensure_assessment(
    db: AsyncSession, moment_id: uuid.UUID, *, lang: str = "es"
) -> dict[str, Any]:
    """El "constructor" es sobre el momento tipo `assess`: si no existe, se
    crea vacía la primera vez que el editor entra."""
    existente = (
        await db.execute(select(Assessment.id).where(Assessment.moment_id == moment_id))
    ).scalar_one_or_none()
    if existente is None:
        assessment = Assessment(moment_id=moment_id)
        db.add(assessment)
        await db.flush()
        existente = assessment.id
    return _serializar_assessment(await _get_full(db, existente), lang)


async def update_assessment(
    db: AsyncSession, assessment_id: uuid.UUID, *, lang: str = "es", **campos: Any
) -> dict[str, Any]:
    assessment = await _get_full(db, assessment_id)
    for campo in ("max_attempts", "pass_score", "team_mode"):
        if (valor := campos.get(campo)) is not None:
            setattr(assessment, campo, valor)
    await db.flush()
    return _serializar_assessment(await _get_full(db, assessment_id), lang)


def _validar_kind(kind: str) -> None:
    if kind not in QuestionKind:
        raise ValidationFailed(f"Tipo de pregunta inválido: {kind}")


async def create_question(
    db: AsyncSession,
    assessment_id: uuid.UUID,
    *,
    kind: str,
    lang: str = "es",
    prompt: str = "",
    points: float = 1.0,
    correct_numeric: float | None = None,
    choices: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    _validar_kind(kind)
    assessment = await _get_full(db, assessment_id)

    siguiente = max((q.order for q in assessment.questions), default=-1) + 1
    question = Question(
        assessment_id=assessment_id,
        kind=kind,
        order=siguiente,
        points=points,
        correct_numeric=correct_numeric,
    )
    db.add(question)
    await db.flush()

    if prompt:
        db.add(QuestionTranslation(question_id=question.id, lang=lang, prompt=prompt))

    for orden, choice_in in enumerate(choices or []):
        choice = Choice(
            question_id=question.id,
            order=orden,
            is_correct=bool(choice_in.get("is_correct")),
        )
        db.add(choice)
        await db.flush()
        if label := choice_in.get("label"):
            db.add(ChoiceTranslation(choice_id=choice.id, lang=lang, label=label))

    await db.flush()
    assessment = await _get_full(db, assessment_id)
    pregunta = next(q for q in assessment.questions if q.id == question.id)
    return _serializar_question(pregunta, lang)


async def _get_question(db: AsyncSession, question_id: uuid.UUID) -> Question:
    question = (
        await db.execute(
            select(Question)
            .where(Question.id == question_id)
            .options(
                selectinload(Question.choices).selectinload(Choice.translations),
                selectinload(Question.translations),
            )
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if question is None:
        raise NotFound("Pregunta no encontrada")
    return question


async def update_question(
    db: AsyncSession, question_id: uuid.UUID, *, lang: str = "es", **campos: Any
) -> dict[str, Any]:
    question = await _get_question(db, question_id)

    if "kind" in campos and campos["kind"] is not None:
        _validar_kind(campos["kind"])
        question.kind = campos["kind"]
    for campo in ("points", "correct_numeric"):
        if campo in campos and campos[campo] is not None:
            setattr(question, campo, campos[campo])

    if (prompt := campos.get("prompt")) is not None:
        tr = next((t for t in question.translations if t.lang == lang), None)
        if tr is None:
            question.translations.append(QuestionTranslation(lang=lang, prompt=prompt))
        else:
            tr.prompt = prompt

    await db.flush()
    return _serializar_question(await _get_question(db, question_id), lang)


async def delete_question(db: AsyncSession, question_id: uuid.UUID) -> None:
    question = await _get_question(db, question_id)
    await db.delete(question)
    await db.flush()


async def reorder_questions(
    db: AsyncSession, assessment_id: uuid.UUID, question_ids: list[uuid.UUID]
) -> dict[str, Any]:
    assessment = await _get_full(db, assessment_id)
    actuales = {q.id for q in assessment.questions}
    if set(question_ids) != actuales or len(question_ids) != len(actuales):
        raise ValidationFailed(
            "El reordenamiento debe incluir exactamente las preguntas de la "
            "evaluación, una sola vez cada una"
        )
    por_id = {q.id: q for q in assessment.questions}
    for posicion, qid in enumerate(question_ids):
        por_id[qid].order = posicion
    await db.flush()
    return _serializar_assessment(await _get_full(db, assessment_id), "es")


async def add_choice(
    db: AsyncSession,
    question_id: uuid.UUID,
    *,
    lang: str = "es",
    label: str,
    is_correct: bool = False,
) -> dict[str, Any]:
    question = await _get_question(db, question_id)
    siguiente = max((c.order for c in question.choices), default=-1) + 1
    choice = Choice(question_id=question_id, order=siguiente, is_correct=is_correct)
    db.add(choice)
    await db.flush()
    db.add(ChoiceTranslation(choice_id=choice.id, lang=lang, label=label))
    await db.flush()
    question = await _get_question(db, question_id)
    return _serializar_choice(
        next(c for c in question.choices if c.id == choice.id), lang
    )


async def update_choice(
    db: AsyncSession, choice_id: uuid.UUID, *, lang: str = "es", **campos: Any
) -> dict[str, Any]:
    choice = (
        await db.execute(
            select(Choice)
            .where(Choice.id == choice_id)
            .options(selectinload(Choice.translations))
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if choice is None:
        raise NotFound("Opción no encontrada")

    if (correcta := campos.get("is_correct")) is not None:
        choice.is_correct = correcta
    if (label := campos.get("label")) is not None:
        tr = next((t for t in choice.translations if t.lang == lang), None)
        if tr is None:
            choice.translations.append(ChoiceTranslation(lang=lang, label=label))
        else:
            tr.label = label
    await db.flush()
    return _serializar_choice(choice, lang)


async def delete_choice(db: AsyncSession, choice_id: uuid.UUID) -> None:
    choice = (
        await db.execute(select(Choice).where(Choice.id == choice_id))
    ).scalar_one_or_none()
    if choice is None:
        raise NotFound("Opción no encontrada")
    await db.delete(choice)
    await db.flush()


def _serializar_choice_para_estudiante(choice: Choice, lang: str) -> dict[str, Any]:
    """Como `_serializar_choice` pero SIN `is_correct` -- es la clave de
    respuestas, filtrarla en el cliente no sirve (DevTools la lee igual)."""
    tr = next((t for t in choice.translations if t.lang == lang), None)
    return {
        "id": str(choice.id),
        "order": choice.order,
        "label": tr.label if tr else None,
    }


def _serializar_question_para_estudiante(question: Question, lang: str) -> dict[str, Any]:
    tr = next((t for t in question.translations if t.lang == lang), None)
    return {
        "id": str(question.id),
        "kind": question.kind,
        "order": question.order,
        "points": question.points,
        # `correct_numeric` tampoco se manda: es la respuesta correcta.
        "prompt": tr.prompt if tr else None,
        "choices": [
            _serializar_choice_para_estudiante(c, lang)
            for c in sorted(question.choices, key=lambda c: c.order)
        ],
    }


async def get_for_student(
    db: AsyncSession, moment_id: uuid.UUID, *, lang: str = "es"
) -> dict[str, Any]:
    """R10/A2: lo que el estudiante necesita para RESPONDER, sin la clave de
    respuestas. `moment_id`, no `assessment_id` -- el estudiante llega desde
    el momento que está viendo, igual que el resto del camino de lectura."""
    assessment = (
        await db.execute(
            select(Assessment)
            .where(Assessment.moment_id == moment_id)
            .options(
                selectinload(Assessment.questions)
                .selectinload(Question.choices)
                .selectinload(Choice.translations),
                selectinload(Assessment.questions).selectinload(Question.translations),
            )
        )
    ).scalar_one_or_none()
    if assessment is None:
        raise NotFound("Este momento no tiene evaluación")

    return {
        "id": str(assessment.id),
        "max_attempts": assessment.max_attempts,
        "team_mode": assessment.team_mode,
        "questions": [
            _serializar_question_para_estudiante(q, lang)
            for q in sorted(assessment.questions, key=lambda q: q.order)
        ],
    }


async def list_my_attempts(
    db: AsyncSession, tenant: TenantContext, assessment_id: uuid.UUID
) -> list[dict[str, Any]]:
    """Solo los del que pregunta -- para saber si le queda algún intento y
    retomar uno `in_progress` en vez de perderlo."""
    filas = (
        (
            await db.execute(
                select(Attempt)
                .where(
                    Attempt.assessment_id == assessment_id,
                    Attempt.student_id == tenant.user_id,
                )
                .options(selectinload(Attempt.answers))
                .order_by(Attempt.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [_serializar_attempt(a) for a in filas]


# --- Camino del estudiante (A2, A3) ------------------------------------------


def _serializar_answer(answer: Answer) -> dict[str, Any]:
    return {
        "id": str(answer.id),
        "question_id": str(answer.question_id),
        "choice_id": str(answer.choice_id) if answer.choice_id else None,
        "value_text": answer.value_text,
        "value_numeric": answer.value_numeric,
        "is_correct": answer.is_correct,
        "teacher_score": answer.teacher_score,
        "teacher_feedback": answer.teacher_feedback,
    }


def _serializar_attempt(attempt: Attempt) -> dict[str, Any]:
    return {
        "id": str(attempt.id),
        "assessment_id": str(attempt.assessment_id),
        "status": attempt.status,
        "score": attempt.score,
        "team_label": attempt.team_label,
        "submitted_at": attempt.submitted_at.isoformat()
        if attempt.submitted_at
        else None,
        "answers": [_serializar_answer(a) for a in attempt.answers],
    }


async def _get_attempt(
    db: AsyncSession, attempt_id: uuid.UUID, *, student_id: uuid.UUID | None = None
) -> Attempt:
    stmt = (
        select(Attempt)
        .where(Attempt.id == attempt_id)
        .options(selectinload(Attempt.answers))
        .execution_options(populate_existing=True)
    )
    attempt = (await db.execute(stmt)).scalar_one_or_none()
    if attempt is None:
        raise NotFound("Intento no encontrado")
    # Nunca por id solo: un estudiante no puede leer/editar el intento de otro.
    if student_id is not None and attempt.student_id != student_id:
        raise NotFound("Intento no encontrado")
    return attempt


async def start_attempt(
    db: AsyncSession,
    tenant: TenantContext,
    assessment_id: uuid.UUID,
    *,
    team_label: str | None = None,
) -> dict[str, Any]:
    assessment = (
        await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    ).scalar_one_or_none()
    if assessment is None:
        raise NotFound("Evaluación no encontrada")

    previos = (
        (
            await db.execute(
                select(Attempt).where(
                    Attempt.assessment_id == assessment_id,
                    Attempt.student_id == tenant.user_id,
                )
            )
        )
        .scalars()
        .all()
    )
    # `max_attempts` lo fija el docente por evaluación (decidido con el
    # cliente): cada intento cuenta, no solo los enviados.
    if len(previos) >= assessment.max_attempts:
        raise Conflict(
            f"Ya usaste tus {assessment.max_attempts} intento(s) para esta evaluación"
        )

    attempt = Attempt(
        assessment_id=assessment_id,
        student_id=tenant.user_id,
        institution_id=tenant.require_institution(),
        status=AttemptStatus.IN_PROGRESS,
        team_label=team_label if assessment.team_mode else None,
    )
    db.add(attempt)
    await db.flush()
    return _serializar_attempt(await _get_attempt(db, attempt.id))


async def save_answers(
    db: AsyncSession,
    tenant: TenantContext,
    attempt_id: uuid.UUID,
    respuestas: list[dict[str, Any]],
) -> dict[str, Any]:
    """Parcial, se puede llamar varias veces mientras el intento siga abierto."""
    attempt = await _get_attempt(db, attempt_id, student_id=tenant.user_id)
    if attempt.status != AttemptStatus.IN_PROGRESS:
        raise Conflict("Este intento ya se envió, no se puede seguir editando")

    por_pregunta = {a.question_id: a for a in attempt.answers}
    for r in respuestas:
        qid = uuid.UUID(r["question_id"])
        existente = por_pregunta.get(qid)
        if existente is None:
            existente = Answer(attempt_id=attempt.id, question_id=qid)
            db.add(existente)
            por_pregunta[qid] = existente
        if "choice_id" in r:
            existente.choice_id = uuid.UUID(r["choice_id"]) if r["choice_id"] else None
        if "value_text" in r:
            existente.value_text = r["value_text"]
        if "value_numeric" in r:
            existente.value_numeric = r["value_numeric"]

    await db.flush()
    return _serializar_attempt(await _get_attempt(db, attempt_id))


def _calificar_auto(question: Question, answer: Answer) -> None:
    """A3: mcq/true_false contra `Choice.is_correct`, numeric con tolerancia.
    Las abiertas quedan `is_correct=None` -- las califica el docente (A4)."""
    if question.kind in (QuestionKind.MCQ, QuestionKind.TRUE_FALSE):
        correcta = next((c for c in question.choices if c.is_correct), None)
        answer.is_correct = correcta is not None and answer.choice_id == correcta.id
    elif question.kind == QuestionKind.NUMERIC:
        answer.is_correct = (
            question.correct_numeric is not None
            and answer.value_numeric is not None
            and abs(answer.value_numeric - question.correct_numeric) < TOLERANCIA_NUMERICA
        )
    # OPEN: no se toca.


def _recalcular_score(assessment: Assessment, attempt: Attempt) -> tuple[float, bool]:
    """(puntaje, todo_calificado). El puntaje suma `points` de lo correcto
    (auto) más `teacher_score` de lo abierto ya calificado."""
    preguntas = {q.id: q for q in assessment.questions}
    total = 0.0
    falta_calificar = False
    for answer in attempt.answers:
        pregunta = preguntas.get(answer.question_id)
        if pregunta is None:
            continue
        if pregunta.kind == QuestionKind.OPEN:
            if answer.teacher_score is not None:
                total += answer.teacher_score
            else:
                falta_calificar = True
        elif answer.is_correct:
            total += pregunta.points
    return total, not falta_calificar


async def submit_attempt(
    db: AsyncSession, tenant: TenantContext, attempt_id: uuid.UUID
) -> dict[str, Any]:
    attempt = await _get_attempt(db, attempt_id, student_id=tenant.user_id)
    if attempt.status != AttemptStatus.IN_PROGRESS:
        raise Conflict("Este intento ya se envió")

    assessment = await _get_full(db, attempt.assessment_id)
    preguntas = {q.id: q for q in assessment.questions}
    for answer in attempt.answers:
        pregunta = preguntas.get(answer.question_id)
        if pregunta is not None:
            _calificar_auto(pregunta, answer)

    score, completo = _recalcular_score(assessment, attempt)
    attempt.score = score
    attempt.status = AttemptStatus.GRADED if completo else AttemptStatus.SUBMITTED
    attempt.submitted_at = datetime.now(UTC)
    await db.flush()

    # Avisa a los docentes de los cursos del alumno: hay algo que revisar.
    if not completo:
        from app.modules.identity.models import Course, Enrollment
        from app.modules.notifications import service as notifications

        docentes = (
            await db.execute(
                select(Course.teacher_id)
                .join(Enrollment, Enrollment.course_id == Course.id)
                .where(
                    Enrollment.user_id == tenant.user_id,
                    Course.teacher_id.is_not(None),
                )
            )
        ).scalars().all()
        await notifications.notify_many(
            db,
            user_ids=[d for d in docentes if d],
            institution_id=attempt.institution_id,
            kind="attempt.submitted",
            title="Evaluación por calificar",
            body="Un estudiante envió una evaluación con respuestas abiertas.",
            link="/teacher/grading",
        )

    return _serializar_attempt(await _get_attempt(db, attempt_id))


# --- Calificación manual (A4) y tablero (A5) ---------------------------------


async def grade_answer(
    db: AsyncSession,
    staff_institution_id: uuid.UUID,
    answer_id: uuid.UUID,
    *,
    teacher_score: float,
    teacher_feedback: str | None = None,
) -> dict[str, Any]:
    answer = (
        await db.execute(select(Answer).where(Answer.id == answer_id))
    ).scalar_one_or_none()
    if answer is None:
        raise NotFound("Respuesta no encontrada")

    attempt = await _get_attempt(db, answer.attempt_id)
    if attempt.institution_id != staff_institution_id:
        raise NotFound("Respuesta no encontrada")
    if attempt.status == AttemptStatus.IN_PROGRESS:
        raise Conflict("No se puede calificar un intento que el estudiante no ha enviado")

    answer.teacher_score = teacher_score
    answer.teacher_feedback = teacher_feedback
    await db.flush()

    assessment = await _get_full(db, attempt.assessment_id)
    attempt = await _get_attempt(db, attempt.id)
    score, completo = _recalcular_score(assessment, attempt)
    attempt.score = score
    if completo:
        attempt.status = AttemptStatus.GRADED
    await db.flush()

    from app.modules.notifications import service as notifications

    await notifications.notify(
        db,
        user_id=attempt.student_id,
        institution_id=attempt.institution_id,
        kind="attempt.graded",
        title="Tu evaluación fue calificada",
        body="El docente puntuó una de tus respuestas.",
        link="/student/agenda",
    )
    return _serializar_attempt(await _get_attempt(db, attempt.id))


async def list_attempts(
    db: AsyncSession, staff_institution_id: uuid.UUID, assessment_id: uuid.UUID
) -> list[dict[str, Any]]:
    filas = (
        (
            await db.execute(
                select(Attempt)
                .where(
                    Attempt.assessment_id == assessment_id,
                    Attempt.institution_id == staff_institution_id,
                )
                .options(selectinload(Attempt.answers))
                .order_by(Attempt.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [_serializar_attempt(a) for a in filas]


async def review_rows(
    db: AsyncSession,
    staff_institution_id: uuid.UUID,
    moment_id: uuid.UUID,
    *,
    lang: str = "es",
) -> dict[str, Any]:
    """A4/A5: todo lo que el docente necesita para calificar la evaluación de
    un momento.

    Se pide por `moment_id` (no `assessment_id`) porque el docente llega
    navegando el proyecto publicado, igual que el resto del camino de lectura.
    Devuelve la evaluación con sus preguntas y los intentos ENVIADOS de su
    institución, con el nombre del estudiante y sus respuestas. Sólo LEE — la
    calificación se hace aparte con `grade_answer`.

    Lee `identity.User` (regla de dependencia §2: leer otro módulo está bien;
    escribirlo, no).
    """
    from app.modules.identity.models import User

    assessment = (
        await db.execute(
            select(Assessment)
            .where(Assessment.moment_id == moment_id)
            .options(
                selectinload(Assessment.questions)
                .selectinload(Question.choices)
                .selectinload(Choice.translations),
                selectinload(Assessment.questions).selectinload(Question.translations),
            )
        )
    ).scalar_one_or_none()
    if assessment is None:
        raise NotFound("Este momento no tiene evaluación")

    filas = (
        await db.execute(
            select(Attempt, User.full_name)
            .join(User, User.id == Attempt.student_id)
            .where(
                Attempt.assessment_id == assessment.id,
                Attempt.institution_id == staff_institution_id,
                Attempt.status.in_(
                    (AttemptStatus.SUBMITTED, AttemptStatus.GRADED)
                ),
            )
            .options(selectinload(Attempt.answers))
            .order_by(Attempt.submitted_at.desc())
        )
    ).all()

    return {
        "assessment": _serializar_assessment(assessment, lang),
        "attempts": [
            {
                **_serializar_attempt(attempt),
                "student_id": str(attempt.student_id),
                "student_name": full_name,
            }
            for attempt, full_name in filas
        ],
    }


async def export_url(assessment_id: uuid.UUID) -> dict[str, Any]:
    """A6: `head_object` sobre la key determinista que usa el worker. `db` no
    se toca -- el estado de verdad es "¿existe el fichero en el bucket?"."""
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError

    from app.core.config import settings

    key = f"exports/{assessment_id}.xlsx"
    s3 = boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    )
    try:
        s3.head_object(Bucket=settings.S3_BUCKET, Key=key)
    except (ClientError, BotoCoreError):
        # No solo "no existe todavia" (ClientError 404): un bucket sin
        # configurar en local/tests tampoco puede considerarse listo, no es
        # un 500 -- sigue siendo "pendiente" desde la perspectiva del cliente.
        return {"status": "pendiente"}

    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": key},
        ExpiresIn=settings.PRESIGNED_URL_TTL,
    )
    return {"status": "listo", "url": url}

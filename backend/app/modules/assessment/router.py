"""Evaluación (R10). Dos routers: autoría/calificación en el Studio (`Author`/
`Staff`) y el camino del estudiante bajo `/learn` (`Tenant`)."""

from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.deps import Author, Db, Staff, Tenant
from app.modules.assessment import service
from app.modules.assessment.models import QuestionKind
from app.workers.tasks import enqueue_export

router = APIRouter(prefix="/studio/assessment", tags=["studio"])


class AssessmentPatch(BaseModel):
    max_attempts: int | None = Field(default=None, ge=1)
    pass_score: float | None = None
    team_mode: bool | None = None
    lang: str = Field(default="es", pattern="^(es|en)$")


@router.get("/moments/{moment_id}")
async def get_or_create(moment_id: UUID, author: Author, db: Db, lang: str = "es"):
    """El "constructor" es sobre el momento `assess`: entrar lo crea si hace falta."""
    return await service.ensure_assessment(db, moment_id, lang=lang)


@router.patch("/{assessment_id}")
async def update_assessment(
    assessment_id: UUID, payload: AssessmentPatch, author: Author, db: Db
):
    datos = payload.model_dump(exclude_unset=True)
    lang = datos.pop("lang", "es")
    return await service.update_assessment(db, assessment_id, lang=lang, **datos)


class ChoiceIn(BaseModel):
    label: str = Field(min_length=1)
    is_correct: bool = False


class QuestionIn(BaseModel):
    kind: QuestionKind
    prompt: str = ""
    points: float = 1.0
    correct_numeric: float | None = None
    choices: list[ChoiceIn] = Field(default_factory=list)
    lang: str = Field(default="es", pattern="^(es|en)$")


class QuestionPatch(BaseModel):
    kind: QuestionKind | None = None
    prompt: str | None = None
    points: float | None = None
    correct_numeric: float | None = None
    lang: str = Field(default="es", pattern="^(es|en)$")


class OrderIn(BaseModel):
    question_ids: list[UUID] = Field(min_length=1)


@router.post("/{assessment_id}/questions", status_code=201)
async def create_question(
    assessment_id: UUID, payload: QuestionIn, author: Author, db: Db
):
    return await service.create_question(db, assessment_id, **payload.model_dump())


@router.put("/{assessment_id}/questions/order")
async def reorder_questions(
    assessment_id: UUID, payload: OrderIn, author: Author, db: Db
):
    return await service.reorder_questions(db, assessment_id, payload.question_ids)


@router.patch("/questions/{question_id}")
async def update_question(
    question_id: UUID, payload: QuestionPatch, author: Author, db: Db
):
    datos = payload.model_dump(exclude_unset=True)
    lang = datos.pop("lang", "es")
    return await service.update_question(db, question_id, lang=lang, **datos)


@router.delete("/questions/{question_id}", status_code=204)
async def delete_question(question_id: UUID, author: Author, db: Db) -> None:
    await service.delete_question(db, question_id)


@router.post("/questions/{question_id}/choices", status_code=201)
async def add_choice(question_id: UUID, payload: ChoiceIn, author: Author, db: Db):
    return await service.add_choice(db, question_id, **payload.model_dump())


class ChoicePatch(BaseModel):
    label: str | None = None
    is_correct: bool | None = None
    lang: str = Field(default="es", pattern="^(es|en)$")


@router.patch("/choices/{choice_id}")
async def update_choice(choice_id: UUID, payload: ChoicePatch, author: Author, db: Db):
    datos = payload.model_dump(exclude_unset=True)
    lang = datos.pop("lang", "es")
    return await service.update_choice(db, choice_id, lang=lang, **datos)


@router.delete("/choices/{choice_id}", status_code=204)
async def delete_choice(choice_id: UUID, author: Author, db: Db) -> None:
    await service.delete_choice(db, choice_id)


# --- Calificación manual y tablero (A4, A5) ---------------------------------


class GradeIn(BaseModel):
    teacher_score: float = Field(ge=0)
    teacher_feedback: str | None = None


@router.patch("/answers/{answer_id}")
async def grade_answer(answer_id: UUID, payload: GradeIn, staff: Staff, db: Db):
    return await service.grade_answer(
        db, staff.require_institution(), answer_id, **payload.model_dump()
    )


@router.get("/{assessment_id}/attempts")
async def list_attempts(assessment_id: UUID, staff: Staff, db: Db):
    return await service.list_attempts(db, staff.require_institution(), assessment_id)


@router.post("/{assessment_id}/export", status_code=202)
async def export(assessment_id: UUID, staff: Staff):
    """A6: genera el XLSX en background (openpyxl) y lo sube al bucket bajo
    una key determinista; `GET .../export` da la URL cuando está listo."""
    await enqueue_export(assessment_id, staff.user_id)
    return {"status": "encolado"}


@router.get("/{assessment_id}/export")
async def export_status(assessment_id: UUID, staff: Staff):
    return await service.export_url(assessment_id)


# --- Camino del estudiante (A2, A3) -----------------------------------------

learn_router = APIRouter(prefix="/learn/assessments", tags=["learning"])


@learn_router.get("/moments/{moment_id}")
async def get_for_student(moment_id: UUID, tenant: Tenant, db: Db, lang: str = "es"):
    return await service.get_for_student(db, moment_id, lang=lang)


@learn_router.get("/{assessment_id}/attempts/mine")
async def my_attempts(assessment_id: UUID, tenant: Tenant, db: Db):
    return await service.list_my_attempts(db, tenant, assessment_id)


class StartAttemptIn(BaseModel):
    team_label: str | None = None


@learn_router.post("/{assessment_id}/attempts", status_code=201)
async def start_attempt(
    assessment_id: UUID, payload: StartAttemptIn, tenant: Tenant, db: Db
):
    return await service.start_attempt(
        db, tenant, assessment_id, team_label=payload.team_label
    )


class AnswerIn(BaseModel):
    question_id: UUID
    choice_id: UUID | None = None
    value_text: str | None = None
    value_numeric: float | None = None


class SaveAnswersIn(BaseModel):
    answers: list[AnswerIn]


@learn_router.patch("/attempts/{attempt_id}/answers")
async def save_answers(attempt_id: UUID, payload: SaveAnswersIn, tenant: Tenant, db: Db):
    respuestas = [
        {k: (str(v) if isinstance(v, UUID) else v) for k, v in a.model_dump().items()}
        for a in payload.answers
    ]
    return await service.save_answers(db, tenant, attempt_id, respuestas)


@learn_router.post("/attempts/{attempt_id}/submit")
async def submit_attempt(attempt_id: UUID, tenant: Tenant, db: Db):
    return await service.submit_attempt(db, tenant, attempt_id)

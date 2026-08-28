import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class QuestionKind(StrEnum):
    MCQ = "mcq"
    TRUE_FALSE = "true_false"
    OPEN = "open"
    NUMERIC = "numeric"
    # Tipos con estructura en `Question.config` (texto por idioma dentro):
    ORDERING = "ordering"    # ordenar una secuencia de elementos
    MATCHING = "matching"    # emparejar columna A con columna B
    CLOZE = "cloze"          # completar huecos en un texto


AUTO_KINDS = (
    QuestionKind.MCQ,
    QuestionKind.TRUE_FALSE,
    QuestionKind.NUMERIC,
    QuestionKind.ORDERING,
    QuestionKind.MATCHING,
    QuestionKind.CLOZE,
)


class AttemptStatus(StrEnum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    GRADED = "graded"


class Assessment(Base, UUIDMixin, TimestampMixin):
    """Sólo existe en el momento tipo `assess` (momento 6, R10)."""

    __tablename__ = "assessments"

    moment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("moments.id", ondelete="CASCADE"), unique=True, index=True
    )
    max_attempts: Mapped[int] = mapped_column(Integer, default=1)
    pass_score: Mapped[float] = mapped_column(Float, default=60.0)
    # Individual o por equipo "segun lo que asigne el docente en la tarea, con
    # libertad" -- decision del cliente (ver docs/backlog.md A2). No hay
    # entidad Team: solo marca si `Attempt.team_label` aplica.
    team_mode: Mapped[bool] = mapped_column(Boolean, default=False)

    questions: Mapped[list["Question"]] = relationship(
        back_populates="assessment",
        cascade="all, delete-orphan",
        order_by="Question.order",
    )


class Question(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "questions"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(20))
    order: Mapped[int] = mapped_column(Integer, default=0)
    points: Mapped[float] = mapped_column(Float, default=1.0)
    # Para NUMERIC; en MCQ/TRUE_FALSE la respuesta vive en Choice.is_correct.
    correct_numeric: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Estructura de ORDERING/MATCHING/CLOZE, con el texto por idioma dentro
    # (`{es: ..., en: ...}`). La clave de respuesta también vive aquí y se
    # filtra al servir al estudiante (`_config_para_estudiante`).
    config: Mapped[dict] = mapped_column(JSONB, default=dict)
    # Etiquetado editorial para el banco de ítems / informes. Texto libre: sin
    # catálogo de competencias MEN en el MVP.
    competency: Mapped[str | None] = mapped_column(String(120), nullable=True)
    difficulty: Mapped[str | None] = mapped_column(String(10), nullable=True)

    assessment: Mapped["Assessment"] = relationship(back_populates="questions")
    choices: Mapped[list["Choice"]] = relationship(cascade="all, delete-orphan")
    translations: Mapped[list["QuestionTranslation"]] = relationship(
        cascade="all, delete-orphan"
    )
    rubric: Mapped["Rubric | None"] = relationship(
        cascade="all, delete-orphan", uselist=False
    )


class QuestionTranslation(Base, UUIDMixin):
    __tablename__ = "question_translations"
    __table_args__ = (UniqueConstraint("question_id", "lang", name="uq_question_lang"),)

    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    lang: Mapped[str] = mapped_column(String(2))
    prompt: Mapped[str] = mapped_column(Text)


class Choice(Base, UUIDMixin):
    __tablename__ = "choices"

    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    translations: Mapped[list["ChoiceTranslation"]] = relationship(
        cascade="all, delete-orphan"
    )


class ChoiceTranslation(Base, UUIDMixin):
    __tablename__ = "choice_translations"
    __table_args__ = (UniqueConstraint("choice_id", "lang", name="uq_choice_lang"),)

    choice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("choices.id", ondelete="CASCADE"), index=True
    )
    lang: Mapped[str] = mapped_column(String(2))
    label: Mapped[str] = mapped_column(Text)


class Attempt(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "attempts"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(20), default=AttemptStatus.IN_PROGRESS)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Libre, la escribe quien envía el intento -- "Equipo 3". Solo agrupa en
    # el tablero de resultados (A5), no hay membresía real que mantener.
    team_label: Mapped[str | None] = mapped_column(String(120), nullable=True)

    answers: Mapped[list["Answer"]] = relationship(cascade="all, delete-orphan")


class Answer(Base, UUIDMixin):
    __tablename__ = "answers"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    choice_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("choices.id", ondelete="SET NULL"), nullable=True
    )
    value_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_numeric: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Auto-calificable: se resuelve al enviar.
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    # Abiertas: las califica el docente a mano.
    teacher_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    teacher_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Puntuación por criterio de rúbrica: `{criterion_id: points}`. Al guardarla
    # el servicio recalcula `teacher_score` como su suma.
    rubric_scores: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class Rubric(Base, UUIDMixin):
    """Rúbrica de una pregunta abierta: criterios con niveles y puntos.

    Una por pregunta como mucho (uselist=False). Los textos van en columnas
    simples, no en tabla de traducción: una rúbrica la lee el docente, no el
    estudiante, y el equipo editorial trabaja en un idioma."""

    __tablename__ = "rubrics"

    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), unique=True, index=True
    )
    criteria: Mapped[list["RubricCriterion"]] = relationship(
        cascade="all, delete-orphan", order_by="RubricCriterion.order"
    )


class RubricCriterion(Base, UUIDMixin):
    __tablename__ = "rubric_criteria"

    rubric_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("rubrics.id", ondelete="CASCADE"), index=True
    )
    order: Mapped[int] = mapped_column(Integer, default=0)
    title: Mapped[str] = mapped_column(String(200))
    max_points: Mapped[float] = mapped_column(Float, default=1.0)
    levels: Mapped[list["RubricLevel"]] = relationship(
        cascade="all, delete-orphan", order_by="RubricLevel.points"
    )


class RubricLevel(Base, UUIDMixin):
    __tablename__ = "rubric_levels"

    criterion_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("rubric_criteria.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    points: Mapped[float] = mapped_column(Float, default=0.0)

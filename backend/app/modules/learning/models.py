import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class ProgressState(StrEnum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Progress(Base, UUIDMixin, TimestampMixin):
    """Progreso a nivel de MOMENTO, no de proyecto.

    El docente necesita saber en qué momento va cada equipo, no sólo
    qué proyectos terminó.
    """

    __tablename__ = "progress"
    __table_args__ = (UniqueConstraint("user_id", "moment_id", name="uq_progress"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    moment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("moments.id", ondelete="CASCADE"), index=True
    )
    # Desnormalizado a propósito: el tablero docente filtra por institución
    # sin joins, y TenantContext puede aplicarse directo aquí.
    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    state: Mapped[str] = mapped_column(String(20), default=ProgressState.NOT_STARTED)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class BlockInteraction(Base, UUIDMixin, TimestampMixin):
    """Lo que un alumno hace DENTRO de un bloque interactivo: qué pasos de la
    checklist marcó, qué respondió en el mini-quiz de comprensión, el estado de
    su workspace de Blockly.

    No cuenta para la nota (para eso está `assessment`) ni bloquea el progreso
    lineal (eso es a nivel de momento). Sólo persiste para que el alumno no
    pierda su trabajo al salir y volver.
    """

    __tablename__ = "block_interactions"
    __table_args__ = (
        UniqueConstraint("user_id", "block_id", name="uq_block_interaction"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # El bloque vive en `catalog`; se referencia sin FK real para no acoplar el
    # esquema a un modelo de otro módulo, igual que `RefType` en `studio`. Si el
    # bloque desaparece, la fila queda huérfana y no se sirve — inofensivo.
    block_id: Mapped[uuid.UUID] = mapped_column(index=True)
    # Desnormalizado como en `Progress`: el filtro de tenant se aplica directo.
    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    state: Mapped[dict] = mapped_column(JSONB, default=dict)

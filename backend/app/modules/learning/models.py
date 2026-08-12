import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
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

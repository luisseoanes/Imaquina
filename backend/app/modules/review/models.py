import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDMixin

__all__ = ["ReviewComment", "ReviewEvent"]


class ReviewComment(Base, UUIDMixin):
    """Hilo de comentarios sobre un contenido en revisión.

    Anclado a un proyecto y, opcionalmente, a un momento o bloque concreto para
    que el editor sepa a qué se refiere. Contenido global (sin `institution_id`):
    el catálogo es de todos las instituciones."""

    __tablename__ = "review_comments"

    # Polimórfico como `studio.RefType`: sin FK real, lo cuida el servicio.
    target_type: Mapped[str] = mapped_column(String(20))  # project | lesson
    target_id: Mapped[uuid.UUID] = mapped_column(index=True)
    moment_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    block_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    body: Mapped[str] = mapped_column(Text)
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class ReviewEvent(Base, UUIDMixin):
    """Una transición de estado del contenido: quién, cuándo, de qué a qué.

    El editor lo consulta como historial del contenido; no es el `audit_log`
    (que es registro de cumplimiento). Puede coexistir con una entrada de
    auditoría para las acciones sensibles."""

    __tablename__ = "review_events"

    target_type: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[uuid.UUID] = mapped_column(index=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

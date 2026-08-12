import uuid
from enum import StrEnum

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config import settings
from app.db.base import Base, TimestampMixin, UUIDMixin


class ChatRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"


class DocumentChunk(Base, UUIDMixin, TimestampMixin):
    """Índice del RAG.

    Referencia `moment_id` para que el chat pueda priorizar el contexto del
    momento actual y citar la fuente. Se regenera entero al publicar
    (el reindexado es idempotente: borrar y recrear, nunca acumular).
    """

    __tablename__ = "document_chunks"

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    moment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("moments.id", ondelete="CASCADE"), index=True, nullable=True
    )
    lang: Mapped[str] = mapped_column(String(2), index=True)
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(settings.EMBEDDING_DIM))


class ChatSession(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "chat_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    moment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("moments.id", ondelete="SET NULL"), nullable=True
    )
    lang: Mapped[str] = mapped_column(String(2), default="es")


class ChatMessage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "chat_messages"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cache_read_tokens: Mapped[int] = mapped_column(Integer, default=0)
    # Registro de rechazos del guardrail, para afinar el clasificador (R9).
    was_redirected: Mapped[bool] = mapped_column(default=False)

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class MediaAsset(Base, UUIDMixin, TimestampMixin):
    """Librería reutilizable de media.

    El binario NUNCA pasa por FastAPI: el navegador sube directo a S3/R2 con
    URL prefirmada y aquí sólo se registra la clave (ver arquitectura.md 7).
    """

    __tablename__ = "media_assets"

    s3_key: Mapped[str] = mapped_column(String(500), unique=True)
    mime_type: Mapped[str] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    original_filename: Mapped[str] = mapped_column(String(300))
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Obligatorio por accesibilidad: el Studio no deja publicar sin alt.
    alt_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

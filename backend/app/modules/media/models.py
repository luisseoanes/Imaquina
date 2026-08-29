import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class MediaFolder(Base, UUIDMixin, TimestampMixin):
    """Carpeta de la biblioteca de medios. Global, como el resto del catálogo.
    Árbol simple por `parent_id`; la integridad del árbol la cuida el servicio."""

    __tablename__ = "media_folders"

    name: Mapped[str] = mapped_column(String(120))
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("media_folders.id", ondelete="CASCADE"), nullable=True, index=True
    )


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
    # Pista de subtítulos WebVTT del vídeo, guardada en línea (son pequeñas).
    # El cliente la sirve como un blob al `<track>`.
    captions_vtt: Mapped[str | None] = mapped_column(Text, nullable=True)
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("media_folders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

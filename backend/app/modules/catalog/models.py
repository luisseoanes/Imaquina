import uuid
from enum import StrEnum

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class MomentType(StrEnum):
    """Los 6 momentos metodologicos del PDF (R7). Orden fijo."""

    INTRO = "intro"              # 1. Introduccion + inclusion
    INQUIRY = "inquiry"          # 2. Indagacion
    DESIGN = "design"            # 3. Diseno
    BUILD = "build"              # 4. Construccion
    COMMUNICATE = "communicate"  # 5. Comunicacion
    ASSESS = "assess"            # 6. Evaluacion


MOMENT_ORDER: tuple[MomentType, ...] = (
    MomentType.INTRO,
    MomentType.INQUIRY,
    MomentType.DESIGN,
    MomentType.BUILD,
    MomentType.COMMUNICATE,
    MomentType.ASSESS,
)


class BlockKind(StrEnum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    EMBED = "embed"
    # Interactivos. Su contenido estructurado (con texto por idioma) vive en
    # `ContentBlock.config`; ver `catalog.service._validar_config` para la forma
    # de cada uno. El estado del alumno (marcas, respuestas) va en
    # `learning.BlockInteraction`, nunca en el bloque.
    CHECKLIST = "checklist"            # guía de armado paso a paso
    VIDEO_CHAPTERS = "video_chapters"  # vídeo con capítulos navegables
    INLINE_QUIZ = "inline_quiz"        # "comprueba tu comprensión", no cuenta nota
    BLOCKLY = "blockly"                # espacio de trabajo de bloques de código
    EMBED_INTERACTIVE = "embed_interactive"  # simulador / visor 3D en iframe


class ProjectStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"


class Project(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "projects"

    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    grade: Mapped[str] = mapped_column(String(20), index=True)
    kit: Mapped[str | None] = mapped_column(String(120), nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(
        String(20), default=ProjectStatus.DRAFT, index=True
    )

    moments: Mapped[list["Moment"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Moment.order",
    )
    translations: Mapped[list["ProjectTranslation"]] = relationship(
        cascade="all, delete-orphan"
    )


class ProjectTranslation(Base, UUIDMixin):
    """i18n en tabla, no en columnas _es/_en. Un tercer idioma no rompe el esquema."""

    __tablename__ = "project_translations"
    __table_args__ = (UniqueConstraint("project_id", "lang", name="uq_project_lang"),)

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    lang: Mapped[str] = mapped_column(String(2))
    title: Mapped[str] = mapped_column(String(300))
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)


class Moment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "moments"
    __table_args__ = (UniqueConstraint("project_id", "type", name="uq_moment_type"),)

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[str] = mapped_column(String(20))
    order: Mapped[int] = mapped_column(Integer)

    project: Mapped["Project"] = relationship(back_populates="moments")
    blocks: Mapped[list["ContentBlock"]] = relationship(
        back_populates="moment",
        cascade="all, delete-orphan",
        order_by="ContentBlock.order",
    )
    translations: Mapped[list["MomentTranslation"]] = relationship(
        cascade="all, delete-orphan"
    )


class MomentTranslation(Base, UUIDMixin):
    __tablename__ = "moment_translations"
    __table_args__ = (UniqueConstraint("moment_id", "lang", name="uq_moment_lang"),)

    moment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("moments.id", ondelete="CASCADE"), index=True
    )
    lang: Mapped[str] = mapped_column(String(2))
    title: Mapped[str] = mapped_column(String(300))
    # El "boton del docente" (R4). NUNCA se serializa para estudiantes.
    teacher_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Pregunta con la que el chatbot abre el momento (R8).
    chatbot_opening_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)


class ContentBlock(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "content_blocks"

    moment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("moments.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(20))
    order: Mapped[int] = mapped_column(Integer, default=0)
    media_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    # Datos del bloque que NO dependen del idioma: proveedor y URL de un embed,
    # id del vídeo de YouTube, y —desde la fase de interactivos— la forma de un
    # checklist, los capítulos de un vídeo o el toolbox de Blockly. Forma libre
    # a propósito (igual que `ContentTemplate.payload`): la valida
    # `catalog.service` al guardar según el `kind`, no la base. Viaja tal cual
    # al snapshot publicado y el cliente del estudiante la interpreta.
    config: Mapped[dict] = mapped_column(JSONB, default=dict)

    moment: Mapped["Moment"] = relationship(back_populates="blocks")
    translations: Mapped[list["BlockTranslation"]] = relationship(
        cascade="all, delete-orphan"
    )


class BlockTranslation(Base, UUIDMixin):
    __tablename__ = "block_translations"
    __table_args__ = (UniqueConstraint("block_id", "lang", name="uq_block_lang"),)

    block_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("content_blocks.id", ondelete="CASCADE"), index=True
    )
    lang: Mapped[str] = mapped_column(String(2))
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    alt_text: Mapped[str | None] = mapped_column(String(500), nullable=True)

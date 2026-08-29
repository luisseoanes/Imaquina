"""Modelos de los dominios propios del Content Studio.

i18n en tablas de traducción, no en columnas `_es`/`_en` (misma decisión que
`catalog`): añadir un tercer idioma no rompe el esquema.

Contenido global: sin `institution_id`. Ver el docstring del módulo.
"""

import uuid
from enum import StrEnum

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

__all__ = [
    "ContentStatus",
    "ResourceKind",
    "RefType",
    "TemplateKind",
    "Lesson",
    "LessonTranslation",
    "Resource",
    "ResourceTranslation",
    "LearningPath",
    "LearningPathTranslation",
    "LearningPathItem",
    "ContentTemplate",
    "Tag",
    "ContentTag",
    "Collection",
    "CollectionTranslation",
    "CollectionItem",
    "GlossaryTerm",
]


class ContentStatus(StrEnum):
    """Mismo borrador→publicado que `ProjectStatus` (scope-mvp.md §3: no hay
    flujo de aprobación multinivel en el MVP)."""

    DRAFT = "draft"
    PUBLISHED = "published"


class ResourceKind(StrEnum):
    LINK = "link"          # URL externa (YouTube, datasheet, etc.)
    FILE = "file"          # archivo en la librería de media
    DOC = "doc"            # documento redactado en el propio Studio


class RefType(StrEnum):
    """Qué puede apuntar un ítem de ruta / colección / etiqueta.

    Un enum y no una FK real porque el destino es polimórfico. La integridad
    referencial se cuida en el servicio al insertar, no en la base.
    """

    PROJECT = "project"
    LESSON = "lesson"
    RESOURCE = "resource"
    ASSESSMENT = "assessment"


class TemplateKind(StrEnum):
    PROJECT = "project"
    LESSON = "lesson"


# --- Lecciones -----------------------------------------------------------
#
# Contenido autónomo que no es un proyecto de 6 momentos: una explicación de un
# sensor, un tutorial de bloque de código. Un solo cuerpo de texto enriquecido
# por idioma (mismo esquema acotado que `lib/richText` en el cliente), sin
# editor de bloques — para eso están los proyectos.


class Lesson(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "lessons"

    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    area: Mapped[str] = mapped_column(String(80), index=True)
    grade: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default=ContentStatus.DRAFT, index=True
    )
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    translations: Mapped[list["LessonTranslation"]] = relationship(
        cascade="all, delete-orphan"
    )


class LessonTranslation(Base, UUIDMixin):
    __tablename__ = "lesson_translations"
    __table_args__ = (UniqueConstraint("lesson_id", "lang", name="uq_lesson_lang"),)

    lesson_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lessons.id", ondelete="CASCADE"), index=True
    )
    lang: Mapped[str] = mapped_column(String(2))
    title: Mapped[str] = mapped_column(String(300))
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)


# --- Recursos ----------------------------------------------------------------


class Resource(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "resources"

    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    area: Mapped[str] = mapped_column(String(80), index=True)
    kind: Mapped[str] = mapped_column(String(20), default=ResourceKind.LINK)
    status: Mapped[str] = mapped_column(
        String(20), default=ContentStatus.DRAFT, index=True
    )
    url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    media_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )

    translations: Mapped[list["ResourceTranslation"]] = relationship(
        cascade="all, delete-orphan"
    )


class ResourceTranslation(Base, UUIDMixin):
    __tablename__ = "resource_translations"
    __table_args__ = (
        UniqueConstraint("resource_id", "lang", name="uq_resource_lang"),
    )

    resource_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("resources.id", ondelete="CASCADE"), index=True
    )
    lang: Mapped[str] = mapped_column(String(2))
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


# --- Rutas de aprendizaje --------------------------------------------------
#
# scope-mvp.md marcaba "editor visual drag-and-drop de layouts" como fuera de
# alcance; una ruta NO es eso: es una lista ordenada de contenidos ya
# existentes. El progreso lineal obligatorio (decisión del cliente, 18/08/2026)
# sigue viviendo en `learning`; esto sólo define la secuencia curada.


class LearningPath(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "learning_paths"

    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    grade: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default=ContentStatus.DRAFT, index=True
    )

    translations: Mapped[list["LearningPathTranslation"]] = relationship(
        cascade="all, delete-orphan"
    )
    items: Mapped[list["LearningPathItem"]] = relationship(
        cascade="all, delete-orphan", order_by="LearningPathItem.order"
    )


class LearningPathTranslation(Base, UUIDMixin):
    __tablename__ = "learning_path_translations"
    __table_args__ = (
        UniqueConstraint("learning_path_id", "lang", name="uq_learning_path_lang"),
    )

    learning_path_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("learning_paths.id", ondelete="CASCADE"), index=True
    )
    lang: Mapped[str] = mapped_column(String(2))
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class LearningPathItem(Base, UUIDMixin):
    __tablename__ = "learning_path_items"

    learning_path_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("learning_paths.id", ondelete="CASCADE"), index=True
    )
    order: Mapped[int] = mapped_column(Integer, default=0)
    ref_type: Mapped[str] = mapped_column(String(20))
    ref_id: Mapped[uuid.UUID] = mapped_column()


# --- Plantillas ------------------------------------------------------------
#
# `duplicate_project` copia un proyecto concreto; una plantilla guarda una
# ESTRUCTURA (títulos de momentos, bloques vacíos, evaluación base) desligada
# de cualquier proyecto, para arrancar los 36 con el mismo molde.


class ContentTemplate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "content_templates"

    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    kind: Mapped[str] = mapped_column(String(20), default=TemplateKind.PROJECT)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Estructura serializada. Forma libre a propósito: la valida quien
    # instancia la plantilla, no la base.
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


# --- Etiquetas -----------------------------------------------------------


class Tag(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tags"

    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    # Token semántico del cliente ("brand", "note", "success"...), no un color
    # crudo: la paleta la fija `index.css`.
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)


class ContentTag(Base, UUIDMixin):
    __tablename__ = "content_tags"
    __table_args__ = (
        UniqueConstraint(
            "tag_id", "target_type", "target_id", name="uq_content_tag"
        ),
    )

    tag_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tags.id", ondelete="CASCADE"), index=True
    )
    target_type: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[uuid.UUID] = mapped_column(index=True)


# --- Colecciones ---------------------------------------------------------


class Collection(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "collections"

    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)

    translations: Mapped[list["CollectionTranslation"]] = relationship(
        cascade="all, delete-orphan"
    )
    items: Mapped[list["CollectionItem"]] = relationship(
        cascade="all, delete-orphan", order_by="CollectionItem.order"
    )


class CollectionTranslation(Base, UUIDMixin):
    __tablename__ = "collection_translations"
    __table_args__ = (
        UniqueConstraint("collection_id", "lang", name="uq_collection_lang"),
    )

    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), index=True
    )
    lang: Mapped[str] = mapped_column(String(2))
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class CollectionItem(Base, UUIDMixin):
    __tablename__ = "collection_items"

    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), index=True
    )
    order: Mapped[int] = mapped_column(Integer, default=0)
    target_type: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[uuid.UUID] = mapped_column(index=True)


# --- Glosario / termbase ------------------------------------------------
#
# Vocabulario acordado ES↔EN para que las traducciones sean coherentes entre
# proyectos ("placa controladora" siempre "controller board", no "control
# board"). Global, como el resto del catálogo.


class GlossaryTerm(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "glossary_terms"
    __table_args__ = (
        UniqueConstraint(
            "source_lang", "target_lang", "term_source", name="uq_glossary_term"
        ),
    )

    source_lang: Mapped[str] = mapped_column(String(2))
    target_lang: Mapped[str] = mapped_column(String(2))
    term_source: Mapped[str] = mapped_column(String(200), index=True)
    term_target: Mapped[str] = mapped_column(String(200))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    domain: Mapped[str | None] = mapped_column(String(80), nullable=True)

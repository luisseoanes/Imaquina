"""embeddings de gemini: vector(768)

Revision ID: a1c2e3f4b5d6
Revises: d22d7e409651
Create Date: 2026-08-25 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = 'a1c2e3f4b5d6'
down_revision: str | None = 'd22d7e409651'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Los chunks son regenerables (reindexado idempotente al publicar), así
    # que en vez de reconvertir vectores de 1024 a 768 se trunca y se deja
    # que el próximo publish/reindex los rellene con embeddings reales.
    op.execute("TRUNCATE document_chunks")
    op.alter_column(
        'document_chunks', 'embedding',
        type_=Vector(768),
        postgresql_using='embedding::vector(768)',
    )


def downgrade() -> None:
    op.execute("TRUNCATE document_chunks")
    op.alter_column(
        'document_chunks', 'embedding',
        type_=Vector(1024),
        postgresql_using='embedding::vector(1024)',
    )

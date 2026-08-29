"""glosario / termbase de traducción

Revision ID: e6f3a1d9b2c8
Revises: d5e2b8c3f1a9
Create Date: 2026-08-28 17:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = 'e6f3a1d9b2c8'
down_revision: str | None = 'd5e2b8c3f1a9'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'glossary_terms',
        sa.Column('source_lang', sa.String(length=2), nullable=False),
        sa.Column('target_lang', sa.String(length=2), nullable=False),
        sa.Column('term_source', sa.String(length=200), nullable=False),
        sa.Column('term_target', sa.String(length=200), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('domain', sa.String(length=80), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('source_lang', 'target_lang', 'term_source', name='uq_glossary_term'),
    )
    op.create_index(op.f('ix_glossary_terms_term_source'), 'glossary_terms', ['term_source'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_glossary_terms_term_source'), table_name='glossary_terms')
    op.drop_table('glossary_terms')

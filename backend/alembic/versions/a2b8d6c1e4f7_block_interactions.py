"""block_interactions: estado del alumno en bloques interactivos

Revision ID: a2b8d6c1e4f7
Revises: f1a9c4b2e7d3
Create Date: 2026-08-28 13:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a2b8d6c1e4f7'
down_revision: str | None = 'f1a9c4b2e7d3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'block_interactions',
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('block_id', sa.Uuid(), nullable=False),
        sa.Column('institution_id', sa.Uuid(), nullable=False),
        sa.Column('state', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['institution_id'], ['institutions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'block_id', name='uq_block_interaction'),
    )
    op.create_index(op.f('ix_block_interactions_user_id'), 'block_interactions', ['user_id'], unique=False)
    op.create_index(op.f('ix_block_interactions_block_id'), 'block_interactions', ['block_id'], unique=False)
    op.create_index(op.f('ix_block_interactions_institution_id'), 'block_interactions', ['institution_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_block_interactions_institution_id'), table_name='block_interactions')
    op.drop_index(op.f('ix_block_interactions_block_id'), table_name='block_interactions')
    op.drop_index(op.f('ix_block_interactions_user_id'), table_name='block_interactions')
    op.drop_table('block_interactions')

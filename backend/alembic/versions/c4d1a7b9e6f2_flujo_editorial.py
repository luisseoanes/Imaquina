"""flujo editorial: revisor, comentarios e historial de estado

Revision ID: c4d1a7b9e6f2
Revises: b3c9e2f1a8d4
Create Date: 2026-08-28 15:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = 'c4d1a7b9e6f2'
down_revision: str | None = 'b3c9e2f1a8d4'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('reviewer_id', sa.Uuid(), nullable=True))
    op.create_foreign_key(
        'projects_reviewer_id_fkey', 'projects', 'users',
        ['reviewer_id'], ['id'], ondelete='SET NULL',
    )

    op.create_table(
        'review_comments',
        sa.Column('target_type', sa.String(length=20), nullable=False),
        sa.Column('target_id', sa.Uuid(), nullable=False),
        sa.Column('moment_id', sa.Uuid(), nullable=True),
        sa.Column('block_id', sa.Uuid(), nullable=True),
        sa.Column('author_id', sa.Uuid(), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_review_comments_target_id'), 'review_comments', ['target_id'], unique=False)
    op.create_index(op.f('ix_review_comments_created_at'), 'review_comments', ['created_at'], unique=False)

    op.create_table(
        'review_events',
        sa.Column('target_type', sa.String(length=20), nullable=False),
        sa.Column('target_id', sa.Uuid(), nullable=False),
        sa.Column('actor_id', sa.Uuid(), nullable=True),
        sa.Column('from_status', sa.String(length=20), nullable=True),
        sa.Column('to_status', sa.String(length=20), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_review_events_target_id'), 'review_events', ['target_id'], unique=False)
    op.create_index(op.f('ix_review_events_created_at'), 'review_events', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_review_events_created_at'), table_name='review_events')
    op.drop_index(op.f('ix_review_events_target_id'), table_name='review_events')
    op.drop_table('review_events')
    op.drop_index(op.f('ix_review_comments_created_at'), table_name='review_comments')
    op.drop_index(op.f('ix_review_comments_target_id'), table_name='review_comments')
    op.drop_table('review_comments')
    op.drop_constraint('projects_reviewer_id_fkey', 'projects', type_='foreignkey')
    op.drop_column('projects', 'reviewer_id')

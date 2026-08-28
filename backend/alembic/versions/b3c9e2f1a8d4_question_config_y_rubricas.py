"""tipos de pregunta con config y rúbricas

Revision ID: b3c9e2f1a8d4
Revises: a2b8d6c1e4f7
Create Date: 2026-08-28 14:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b3c9e2f1a8d4'
down_revision: str | None = 'a2b8d6c1e4f7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'questions',
        sa.Column(
            'config',
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column('questions', sa.Column('competency', sa.String(length=120), nullable=True))
    op.add_column('questions', sa.Column('difficulty', sa.String(length=10), nullable=True))
    op.add_column(
        'answers',
        sa.Column('rubric_scores', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    op.create_table(
        'rubrics',
        sa.Column('question_id', sa.Uuid(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_rubrics_question_id'), 'rubrics', ['question_id'], unique=True)

    op.create_table(
        'rubric_criteria',
        sa.Column('rubric_id', sa.Uuid(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('max_points', sa.Float(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_rubric_criteria_rubric_id'), 'rubric_criteria', ['rubric_id'], unique=False
    )

    op.create_table(
        'rubric_levels',
        sa.Column('criterion_id', sa.Uuid(), nullable=False),
        sa.Column('label', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('points', sa.Float(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['criterion_id'], ['rubric_criteria.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_rubric_levels_criterion_id'), 'rubric_levels', ['criterion_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_rubric_levels_criterion_id'), table_name='rubric_levels')
    op.drop_table('rubric_levels')
    op.drop_index(op.f('ix_rubric_criteria_rubric_id'), table_name='rubric_criteria')
    op.drop_table('rubric_criteria')
    op.drop_index(op.f('ix_rubrics_question_id'), table_name='rubrics')
    op.drop_table('rubrics')
    op.drop_column('answers', 'rubric_scores')
    op.drop_column('questions', 'difficulty')
    op.drop_column('questions', 'competency')
    op.drop_column('questions', 'config')

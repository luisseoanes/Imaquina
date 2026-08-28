"""studio: lecciones, recursos, rutas, plantillas, etiquetas, colecciones

Revision ID: b7f1a2c8d9e0
Revises: a1c2e3f4b5d6
Create Date: 2026-08-27 12:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b7f1a2c8d9e0'
down_revision: str | None = 'a1c2e3f4b5d6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'lessons',
        sa.Column('slug', sa.String(length=120), nullable=False),
        sa.Column('area', sa.String(length=80), nullable=False),
        sa.Column('grade', sa.String(length=20), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('estimated_minutes', sa.Integer(), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_lessons_area'), 'lessons', ['area'], unique=False)
    op.create_index(op.f('ix_lessons_slug'), 'lessons', ['slug'], unique=True)
    op.create_index(op.f('ix_lessons_status'), 'lessons', ['status'], unique=False)

    op.create_table(
        'lesson_translations',
        sa.Column('lesson_id', sa.Uuid(), nullable=False),
        sa.Column('lang', sa.String(length=2), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lesson_id', 'lang', name='uq_lesson_lang'),
    )
    op.create_index(op.f('ix_lesson_translations_lesson_id'), 'lesson_translations', ['lesson_id'], unique=False)

    op.create_table(
        'resources',
        sa.Column('slug', sa.String(length=120), nullable=False),
        sa.Column('area', sa.String(length=80), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('url', sa.String(length=1000), nullable=True),
        sa.Column('media_asset_id', sa.Uuid(), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['media_asset_id'], ['media_assets.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_resources_area'), 'resources', ['area'], unique=False)
    op.create_index(op.f('ix_resources_slug'), 'resources', ['slug'], unique=True)
    op.create_index(op.f('ix_resources_status'), 'resources', ['status'], unique=False)

    op.create_table(
        'resource_translations',
        sa.Column('resource_id', sa.Uuid(), nullable=False),
        sa.Column('lang', sa.String(length=2), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['resource_id'], ['resources.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('resource_id', 'lang', name='uq_resource_lang'),
    )
    op.create_index(op.f('ix_resource_translations_resource_id'), 'resource_translations', ['resource_id'], unique=False)

    op.create_table(
        'learning_paths',
        sa.Column('slug', sa.String(length=120), nullable=False),
        sa.Column('grade', sa.String(length=20), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_learning_paths_slug'), 'learning_paths', ['slug'], unique=True)
    op.create_index(op.f('ix_learning_paths_status'), 'learning_paths', ['status'], unique=False)

    op.create_table(
        'learning_path_translations',
        sa.Column('learning_path_id', sa.Uuid(), nullable=False),
        sa.Column('lang', sa.String(length=2), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['learning_path_id'], ['learning_paths.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('learning_path_id', 'lang', name='uq_learning_path_lang'),
    )
    op.create_index(op.f('ix_learning_path_translations_learning_path_id'), 'learning_path_translations', ['learning_path_id'], unique=False)

    op.create_table(
        'learning_path_items',
        sa.Column('learning_path_id', sa.Uuid(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('ref_type', sa.String(length=20), nullable=False),
        sa.Column('ref_id', sa.Uuid(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['learning_path_id'], ['learning_paths.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_learning_path_items_learning_path_id'), 'learning_path_items', ['learning_path_id'], unique=False)

    op.create_table(
        'content_templates',
        sa.Column('slug', sa.String(length=120), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_by', sa.Uuid(), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_content_templates_slug'), 'content_templates', ['slug'], unique=True)

    op.create_table(
        'tags',
        sa.Column('slug', sa.String(length=80), nullable=False),
        sa.Column('name', sa.String(length=80), nullable=False),
        sa.Column('color', sa.String(length=20), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_tags_slug'), 'tags', ['slug'], unique=True)

    op.create_table(
        'content_tags',
        sa.Column('tag_id', sa.Uuid(), nullable=False),
        sa.Column('target_type', sa.String(length=20), nullable=False),
        sa.Column('target_id', sa.Uuid(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tag_id', 'target_type', 'target_id', name='uq_content_tag'),
    )
    op.create_index(op.f('ix_content_tags_tag_id'), 'content_tags', ['tag_id'], unique=False)
    op.create_index(op.f('ix_content_tags_target_id'), 'content_tags', ['target_id'], unique=False)

    op.create_table(
        'collections',
        sa.Column('slug', sa.String(length=120), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_collections_slug'), 'collections', ['slug'], unique=True)

    op.create_table(
        'collection_translations',
        sa.Column('collection_id', sa.Uuid(), nullable=False),
        sa.Column('lang', sa.String(length=2), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['collection_id'], ['collections.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('collection_id', 'lang', name='uq_collection_lang'),
    )
    op.create_index(op.f('ix_collection_translations_collection_id'), 'collection_translations', ['collection_id'], unique=False)

    op.create_table(
        'collection_items',
        sa.Column('collection_id', sa.Uuid(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('target_type', sa.String(length=20), nullable=False),
        sa.Column('target_id', sa.Uuid(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['collection_id'], ['collections.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_collection_items_collection_id'), 'collection_items', ['collection_id'], unique=False)
    op.create_index(op.f('ix_collection_items_target_id'), 'collection_items', ['target_id'], unique=False)


def downgrade() -> None:
    op.drop_table('collection_items')
    op.drop_table('collection_translations')
    op.drop_table('collections')
    op.drop_table('content_tags')
    op.drop_table('tags')
    op.drop_table('content_templates')
    op.drop_table('learning_path_items')
    op.drop_table('learning_path_translations')
    op.drop_table('learning_paths')
    op.drop_table('resource_translations')
    op.drop_table('resources')
    op.drop_table('lesson_translations')
    op.drop_table('lessons')

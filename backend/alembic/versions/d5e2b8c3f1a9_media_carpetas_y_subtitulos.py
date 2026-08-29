"""biblioteca de medios: carpetas y subtítulos

Revision ID: d5e2b8c3f1a9
Revises: c4d1a7b9e6f2
Create Date: 2026-08-28 16:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = 'd5e2b8c3f1a9'
down_revision: str | None = 'c4d1a7b9e6f2'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'media_folders',
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('parent_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['parent_id'], ['media_folders.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_media_folders_parent_id'), 'media_folders', ['parent_id'], unique=False)

    op.add_column('media_assets', sa.Column('captions_vtt', sa.Text(), nullable=True))
    op.add_column('media_assets', sa.Column('folder_id', sa.Uuid(), nullable=True))
    op.create_foreign_key(
        'media_assets_folder_id_fkey', 'media_assets', 'media_folders',
        ['folder_id'], ['id'], ondelete='SET NULL',
    )
    op.create_index(op.f('ix_media_assets_folder_id'), 'media_assets', ['folder_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_media_assets_folder_id'), table_name='media_assets')
    op.drop_constraint('media_assets_folder_id_fkey', 'media_assets', type_='foreignkey')
    op.drop_column('media_assets', 'folder_id')
    op.drop_column('media_assets', 'captions_vtt')
    op.drop_index(op.f('ix_media_folders_parent_id'), table_name='media_folders')
    op.drop_table('media_folders')

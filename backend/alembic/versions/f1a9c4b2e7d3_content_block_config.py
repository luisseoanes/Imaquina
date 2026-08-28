"""content_block.config: ajustes del bloque no dependientes del idioma

Revision ID: f1a9c4b2e7d3
Revises: c3a8f1e94d20
Create Date: 2026-08-28 12:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f1a9c4b2e7d3'
down_revision: str | None = 'c3a8f1e94d20'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'content_blocks',
        sa.Column(
            'config',
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('content_blocks', 'config')

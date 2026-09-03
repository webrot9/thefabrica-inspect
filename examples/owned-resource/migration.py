"""Add saved_searches table.

INSPECTION RENDERING — not runnable as-is.

Generated from The Fabrica's private resource scaffold for a fictional
`SavedSearch` resource.

REDACTION NOTE: the revision identifiers below (`revision` /
`down_revision`) have been NORMALISED for this inspection copy. In the
private repository they chain onto the real migration head; publishing
that identifier would leak the private migration graph. Only the
revision metadata was changed — the substantive schema (columns, types,
constraints, indexes, and the downgrade path) is exactly what the
scaffold produces.

Note what the migration guarantees at the DATABASE level, not merely in
the ORM: the CASCADE lives in the foreign key itself, so a user delete
removes these rows even if it is issued by a script that never loads
the SQLAlchemy model.

Revision ID: 0001_saved_searches
Revises: 0000_inspection_base
Create Date: normalised for inspection

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic. Normalised — see the note above.
revision: str = "0001_saved_searches"
down_revision: str | Sequence[str] | None = "0000_inspection_base"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create saved_searches table + composite index."""
    op.create_table(
        "saved_searches",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # === BEGIN COLUMNS_BLOCK ===============================================
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("query", sa.Text, nullable=False),
        sa.Column(
            "filters",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        # === END COLUMNS_BLOCK =================================================
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_saved_searches_user_id",
        "saved_searches",
        ["user_id"],
    )
    op.create_index(
        "ix_saved_searches_user_id_created_at",
        "saved_searches",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    """Drop saved_searches + indexes.

    The downgrade is written, not stubbed. The factory's CI runs
    `alembic upgrade head` → `downgrade base` → `upgrade head` on every
    change, so a migration that cannot be reversed fails the build.
    """
    op.drop_index(
        "ix_saved_searches_user_id_created_at",
        table_name="saved_searches",
    )
    op.drop_index("ix_saved_searches_user_id", table_name="saved_searches")
    op.drop_table("saved_searches")

"""SavedSearch — owned-by-user resource.

INSPECTION RENDERING — not runnable as-is.

Generated from The Fabrica's private resource scaffold for a fictional
`SavedSearch` resource, so the engineering contract can be read without
publishing the scaffold itself. The factory primitives this imports
(`Base`, `TimestampMixin`) are intentionally omitted from this
repository: it is meant to be inspected, not executed.

Two invariants the scaffold refuses to generate without:

    - CASCADE on user delete (GDPR Art. 17 right-to-erasure).
    - `(user_id, created_at)` composite index — every "my rows,
      newest-first" list query hits this index rather than sorting
      the user's whole partition.
"""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base, TimestampMixin


class SavedSearch(Base, TimestampMixin):
    """A search a user has saved for reuse.

    Conventions inherited from the factory:
        - CASCADE on user delete (GDPR Art. 17 right-to-erasure).
        - `(user_id, created_at)` composite index.
        - TimestampMixin gives created_at + updated_at automatically.
    """

    __tablename__ = "saved_searches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Owner. CASCADE so this row disappears on GDPR delete.",
    )

    # === BEGIN FIELDS_BLOCK ====================================================
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    filters: Mapped[dict[str, object]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=sa.text("'{}'::jsonb"),
    )
    # === END FIELDS_BLOCK ======================================================

    __table_args__ = (
        Index(
            "ix_saved_searches_user_id_created_at",
            "user_id",
            "created_at",
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"<SavedSearch id={self.id} user={self.user_id}>"

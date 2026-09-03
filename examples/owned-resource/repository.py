"""Async repository for SavedSearch.

INSPECTION RENDERING — not runnable as-is.

Generated from The Fabrica's private resource scaffold for a fictional
`SavedSearch` resource. The factory primitive it extends
(`AsyncBaseRepository`) is intentionally omitted from this repository:
it is meant to be inspected, not executed.

This file is the one worth reading closely. The router performs every
database read through it, so the `WHERE user_id = ...` predicate lives
in ONE place instead of being restated at each endpoint. Omitting that
predicate in a single endpoint is the most common way an owned-resource
API grows an IDOR hole; centralising it means a reviewer confirms
ownership by reading one file rather than auditing every handler.

Ownership is filtered IN SQL — not fetched and then compared in Python.
A row belonging to another user is never loaded into the process.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select

from src.models._domain.saved_search import SavedSearch
from src.services.repositories_async.base import AsyncBaseRepository


class SavedSearchRepository(AsyncBaseRepository[SavedSearch]):
    """One repository, one model. Every query filters by user_id."""

    model = SavedSearch

    async def get_for_user(
        self,
        resource_id: uuid.UUID,
        *,
        user_id: uuid.UUID,
    ) -> SavedSearch | None:
        """Fetch by id WITH ownership check. Returns None for foreign rows.

        This is the ONLY way the router fetches a single row. Calling
        `session.get(SavedSearch, id)` directly would skip the ownership
        filter — the classic IDOR slip.
        """
        stmt = select(SavedSearch).where(
            SavedSearch.id == resource_id,
            SavedSearch.user_id == user_id,
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def list_for_user(
        self,
        *,
        user_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[SavedSearch]:
        """List newest-first. Hits the (user_id, created_at) composite index."""
        stmt = (
            select(SavedSearch)
            .where(SavedSearch.user_id == user_id)
            .order_by(SavedSearch.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return (await self.session.execute(stmt)).scalars().all()

    async def count_for_user(self, *, user_id: uuid.UUID) -> int:
        """Total rows for one user. Powers list pagination + tier-limit checks."""
        stmt = (
            select(func.count())
            .select_from(SavedSearch)
            .where(SavedSearch.user_id == user_id)
        )
        return (await self.session.execute(stmt)).scalar_one()

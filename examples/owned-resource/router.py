"""SavedSearch router — full CRUD owned by the current user.

INSPECTION RENDERING — not runnable as-is.

Generated from The Fabrica's private resource scaffold for a fictional
`SavedSearch` resource. The factory primitives it imports
(`CurrentUserDep`, `DBDep`, `NotFoundError`, `log_action_async`) are
intentionally omitted from this repository: it is meant to be inspected,
not executed.

Endpoints:
    POST   /api/v1/saved_searches          — create
    GET    /api/v1/saved_searches          — list (paginated, newest first)
    GET    /api/v1/saved_searches/{id}     — detail
    PATCH  /api/v1/saved_searches/{id}     — partial update
    DELETE /api/v1/saved_searches/{id}     — delete

Invariants this shape enforces:

    1. Every read goes through `SavedSearchRepository.{get,list}_for_user`,
       so ownership is filtered in SQL rather than checked after loading.
       There is no unscoped `session.get()` path to a row.
    2. Every state change writes an AuditLog row.
    3. AuditLog details NEVER contain user-supplied fields verbatim
       (avoids log injection and PII leakage). What is recorded is a
       curated set of "what changed" keys, not the request body.
    4. A row belonging to another user answers 404, never 403 — a 403
       would confirm that the id exists.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, status

from src.api.deps import CurrentUserDep, DBDep
from src.api.exceptions import NotFoundError
from src.api.schemas._domain.saved_search import (
    SavedSearchCreate,
    SavedSearchList,
    SavedSearchResponse,
    SavedSearchUpdate,
)
from src.models._domain.saved_search import SavedSearch
from src.services.audit import log_action_async
from src.services.repositories_async._domain.saved_search import (
    SavedSearchRepository,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/saved_searches", tags=["saved_searches"])


@router.post(
    "",
    response_model=SavedSearchResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_saved_search(
    body: SavedSearchCreate,
    user: CurrentUserDep,
    db: DBDep,
) -> SavedSearchResponse:
    """Create a new SavedSearch owned by the current user.

    Ownership comes from the authenticated principal, never from the
    request body — `SavedSearchCreate` has no `user_id` field to spoof.
    """
    row = SavedSearch(
        user_id=user.id,
        **body.model_dump(),
    )
    db.add(row)
    await db.flush()
    await log_action_async(
        db,
        actor=f"user:{user.clerk_user_id}",
        action="saved_search.created",
        user_id=user.clerk_user_id,
        resource_type="saved_search",
        resource_id=str(row.id),
        # Audit details are a curated allowlist — never the full body.
        details={"created_via": "api"},
    )
    return SavedSearchResponse.model_validate(row)


@router.get("", response_model=SavedSearchList)
async def list_saved_searches(
    user: CurrentUserDep,
    db: DBDep,
    page: int = 1,
    page_size: int = 50,
) -> SavedSearchList:
    """List the current user's SavedSearch rows, newest first.

    There is no "all rows" code path: the repository method takes
    `user_id` as a required keyword argument.
    """
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 200:
        page_size = 50
    repo = SavedSearchRepository(db)
    rows = await repo.list_for_user(
        user_id=user.id,
        limit=page_size,
        offset=(page - 1) * page_size,
    )
    total = await repo.count_for_user(user_id=user.id)
    return SavedSearchList(
        items=[SavedSearchResponse.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{resource_id}", response_model=SavedSearchResponse)
async def get_saved_search(
    resource_id: uuid.UUID,
    user: CurrentUserDep,
    db: DBDep,
) -> SavedSearchResponse:
    """Detail view. 404 for foreign rows — never 403 (don't leak existence)."""
    repo = SavedSearchRepository(db)
    row = await repo.get_for_user(resource_id, user_id=user.id)
    if row is None:
        raise NotFoundError(f"SavedSearch {resource_id} not found")
    return SavedSearchResponse.model_validate(row)


@router.patch("/{resource_id}", response_model=SavedSearchResponse)
async def update_saved_search(
    resource_id: uuid.UUID,
    body: SavedSearchUpdate,
    user: CurrentUserDep,
    db: DBDep,
) -> SavedSearchResponse:
    """Partial update. Only fields set on the request body are touched."""
    repo = SavedSearchRepository(db)
    row = await repo.get_for_user(resource_id, user_id=user.id)
    if row is None:
        raise NotFoundError(f"SavedSearch {resource_id} not found")

    patch = body.model_dump(exclude_unset=True)
    for k, v in patch.items():
        setattr(row, k, v)
    await db.flush()

    await log_action_async(
        db,
        actor=f"user:{user.clerk_user_id}",
        action="saved_search.updated",
        user_id=user.clerk_user_id,
        resource_type="saved_search",
        resource_id=str(row.id),
        # Field NAMES, not values: an audit trail that records what
        # changed without copying user content into the log.
        details={"fields_changed": sorted(patch.keys())},
    )
    return SavedSearchResponse.model_validate(row)


@router.delete(
    "/{resource_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_saved_search(
    resource_id: uuid.UUID,
    user: CurrentUserDep,
    db: DBDep,
) -> None:
    """Delete one row. 404 for foreign rows."""
    repo = SavedSearchRepository(db)
    row = await repo.get_for_user(resource_id, user_id=user.id)
    if row is None:
        raise NotFoundError(f"SavedSearch {resource_id} not found")
    await db.delete(row)
    await log_action_async(
        db,
        actor=f"user:{user.clerk_user_id}",
        action="saved_search.deleted",
        user_id=user.clerk_user_id,
        resource_type="saved_search",
        resource_id=str(resource_id),
        details={},
    )

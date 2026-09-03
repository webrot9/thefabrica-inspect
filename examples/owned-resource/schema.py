"""Pydantic schemas for the SavedSearch router.

INSPECTION RENDERING — not runnable as-is.

Generated from The Fabrica's private resource scaffold for a fictional
`SavedSearch` resource. Surrounding factory primitives are intentionally
omitted from this repository: it is meant to be inspected, not executed.

Note the split between what a client may SET and what the API RETURNS.
`user_id` appears only on the response model — a client never supplies
ownership, the router takes it from the authenticated principal.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SavedSearchCreate(BaseModel):
    """Body for POST /api/v1/saved_searches."""

    name: str = Field(..., max_length=200)
    query: str
    # `default_factory`, never `default={}` — a shared mutable default
    # would be aliased across every request that omits the field.
    filters: dict[str, Any] = Field(default_factory=dict)


class SavedSearchUpdate(BaseModel):
    """Body for PATCH /api/v1/saved_searches/{id}. All fields optional."""

    name: str | None = Field(default=None, max_length=200)
    query: str | None = Field(default=None)
    filters: dict[str, Any] | None = Field(default=None)


class SavedSearchResponse(BaseModel):
    """One SavedSearch row in GET / list responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    query: str
    filters: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class SavedSearchList(BaseModel):
    """Paginated list response."""

    items: list[SavedSearchResponse]
    total: int
    page: int
    page_size: int

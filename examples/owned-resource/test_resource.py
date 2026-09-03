"""Integration tests for the SavedSearch CRUD endpoints.

INSPECTION RENDERING — not runnable as-is.

Generated from The Fabrica's private resource scaffold for a fictional
`SavedSearch` resource. The fixtures these tests consume
(`authed_client`, `other_user_client`, `anon_client`) live in the
private conftest and are intentionally omitted from this repository:
it is meant to be inspected, not executed.

These are the security regression tests the scaffold generates, kept
here deliberately — they are the point of the example. Three of them
are mandatory in the private repo and are not allowed to be deleted:

    1. Happy path: proves the endpoint works at all.
    2. Foreign row -> 404: proves the ownership filter holds. IDOR is
       the dominant bug class for owned-by-user resources; this test
       fails noisily the moment someone drops the user_id filter.
    3. Anonymous -> 401: proves the authentication dependency is wired.

A generated CRUD endpoint is easy. A generated CRUD endpoint that
arrives with its own IDOR regression test is the part worth inspecting.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.integration


SAMPLE_PAYLOAD = {
    "name": "Remote Python roles",
    "query": "python remote",
    "filters": {"seniority": "senior"},
}


async def test_create_then_fetch_happy_path(authed_client: AsyncClient) -> None:
    """POST returns 201 + GET by id returns the same row."""
    resp = await authed_client.post(
        "/api/v1/saved_searches",
        json=SAMPLE_PAYLOAD,
    )
    assert resp.status_code == 201, resp.text
    created = resp.json()
    resource_id = created["id"]

    fetched = await authed_client.get(
        f"/api/v1/saved_searches/{resource_id}",
    )
    assert fetched.status_code == 200
    assert fetched.json()["id"] == resource_id


async def test_foreign_row_returns_404_not_403(
    authed_client: AsyncClient,
    other_user_client: AsyncClient,
) -> None:
    """Another user's row must look like it doesn't exist.

    REGRESSION GUARD: this is the IDOR test. If someone removes the
    user_id filter in the repository, this test fails immediately
    because the request would return 200 instead of 404.

    404 rather than 403 is deliberate: 403 confirms the id exists,
    which is itself a disclosure.
    """
    create_resp = await other_user_client.post(
        "/api/v1/saved_searches",
        json=SAMPLE_PAYLOAD,
    )
    foreign_id = create_resp.json()["id"]

    get_resp = await authed_client.get(
        f"/api/v1/saved_searches/{foreign_id}",
    )
    assert get_resp.status_code == 404, (
        f"IDOR REGRESSION: user got status {get_resp.status_code} "
        f"for foreign row {foreign_id}. Must be 404 (not 403 — don't "
        f"leak existence)."
    )

    # Same posture for PATCH + DELETE — a write path that skipped the
    # ownership filter would be worse than a leaky read path.
    patch_resp = await authed_client.patch(
        f"/api/v1/saved_searches/{foreign_id}",
        json=SAMPLE_PAYLOAD,
    )
    assert patch_resp.status_code == 404

    del_resp = await authed_client.delete(
        f"/api/v1/saved_searches/{foreign_id}",
    )
    assert del_resp.status_code == 404


async def test_anonymous_request_returns_401(
    anon_client: AsyncClient,
) -> None:
    """No JWT -> 401 from the authentication dependency."""
    resp = await anon_client.get("/api/v1/saved_searches")
    assert resp.status_code == 401


async def test_list_returns_only_my_rows(
    authed_client: AsyncClient,
    other_user_client: AsyncClient,
) -> None:
    """The list endpoint filters by user_id even with no explicit filter."""
    # Other user has 1 row.
    await other_user_client.post(
        "/api/v1/saved_searches",
        json=SAMPLE_PAYLOAD,
    )
    # I have 0 rows.
    resp = await authed_client.get("/api/v1/saved_searches")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0
    assert body["items"] == []


async def test_get_nonexistent_returns_404(
    authed_client: AsyncClient,
) -> None:
    """Random UUID -> 404, not 500."""
    resp = await authed_client.get(
        f"/api/v1/saved_searches/{uuid.uuid4()}",
    )
    assert resp.status_code == 404

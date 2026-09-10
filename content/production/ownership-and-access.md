---
title: "Ownership and access"
description: "Where the ownership filter lives, and why the admin gate is an allowlist."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# Ownership and access

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `docs/recipes/admin-allowlist-vs-roles.md`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

The factory's admin gate is `User.email in project_config.admin_emails`.
That's it. No `roles` table. No `is_admin` column. No RBAC framework.

## What competitors ship

```python
class User:
    is_admin: bool
    is_superuser: bool
    roles: Many[Role]  # → Permission → Endpoint matrix
```

Then a route guard like:
```python
@require_role("admin", "billing.read")
def get_stats(): ...
```

Looks scalable. Reads like enterprise software.

## Where it breaks for founder-scale SaaS

1. **Bootstrap chicken-egg**. Who creates the first admin row? You
   either ship a migration that hard-codes the founder's email
   (defeats the abstraction) or a CLI that requires a DB connection
   to a server you haven't deployed yet.
2. **Promotion ceremony**. "I want my cofounder to be admin" → DB
   query + UPDATE → CI deploy → coffee getting cold. Email allowlist:
   add string to `ADMIN_EMAILS` env var, redeploy. 30 seconds.
3. **Recovery from a compromised account**. RBAC table compromised
   → attacker grants themselves admin → you can't even revoke their
   row because they revoked yours first. Email allowlist lives in
   env vars → not user-mutable from inside the app.
4. **YAGNI on permissions**. Every admin endpoint the factory ships
   needs exactly the same gate — the admin router (users, stats,
   metrics overview, audit log), the broadcast composer, the feedback
   viewer and the email preview. RBAC's value-add is "different admins
   can do different things", which is irrelevant while the answer for
   every endpoint is the same allowlist.

## What we ship

```python
# config/project.py
admin_emails: list[str] = []  # parametric per-buyer

# api/deps.py
async def require_admin(user: CurrentUserDep) -> User:
    allowlist = {e.strip().lower() for e in project_config.admin_emails}
    if user.email.lower() not in allowlist:
        raise ForbiddenError(...)
    return user

AdminDep = Annotated[User, Depends(require_admin)]
```

Wired with:

```bash
ADMIN_EMAILS="founder@acme.com,cofounder@acme.com"
```

Promoting a new admin = add the env var, redeploy. Demoting = remove
it, redeploy. The env var is the source of truth.

## When this stops working

When you need to give different admins different permissions
(e.g. "billing admin can refund but not delete users"). At that point
you have the data — RBAC migration is straightforward because
`User` is your join target. Until then, you save the migration +
the admin UI for the role table + the bug surface from
out-of-sync permission matrices.

## Audit log integration

The admin gate writes nothing on its own; the **endpoints** write
`AuditLog` rows for sensitive actions. So you get the trail
("admin@acme.com deleted user_xyz at 2026-05-12T18:00:00Z") without
the RBAC scaffolding. The audit-log destination is the same
regardless of whether the actor is a free-tier user, a paid user,
or an admin — single table, single shape.

## Receipts

- `backend/src/api/deps.py:require_admin`
- `backend/src/config/project.py:admin_emails`
- `backend/src/api/routers/admin.py` (every endpoint gated by
  `AdminDep` in its function signature); the same gate is applied in
  `broadcast.py`, `feedback.py` and `email.py`

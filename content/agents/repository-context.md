---
title: "What a coding agent is handed"
description: "One canonical instruction file, and the two pointers that reach it."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Extracted from The Fabrica v0.1.2.
     Edits belong in the product documentation, not here. -->

# What a coding agent is handed

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

## What this repo is

A production SaaS built on **The Fabrica** — a Python/FastAPI +
Next.js boilerplate. Backend under `backend/`, frontend under
`frontend/`. If you were forked from the factory, the code you see is
the starting point; the buyer extends it for their own product.

Stack: FastAPI + async SQLAlchemy 2.0 + Postgres + Celery + Redis
(backend); Next.js 16 + React 19 + Tailwind + next-intl (frontend);
Clerk (auth), Paddle (payments, Merchant of Record), Resend (email),
Anthropic/OpenAI (LLM).

## Verification (run before declaring any change done)

Backend:
```bash
uv run ruff check backend/src backend/tests backend/alembic
uv run mypy --strict --ignore-missing-imports backend/src
uv run pytest backend/tests/ -m "not integration"   # fast; no DB needed
uv run pytest backend/tests/                         # full; needs Postgres+Redis
```

Frontend:
```bash
cd frontend
npm run lint          # eslint --max-warnings 0
npm run type-check    # tsc --noEmit
npm test              # vitest run
```

After a model change, and before the tests above:
```bash
uv run alembic revision --autogenerate -m "..."
uv run alembic upgrade head
```

Local services: `docker compose up -d postgres redis`. Run
`npm run build` too when you touch a page — a server/client boundary
error surfaces only there, never in `type-check`.

CI runs all of these. `mypy --strict` and `eslint --max-warnings 0`
are non-negotiable — the bar is zero errors, zero warnings.

### Generating the code is not finishing the task

A diff that exists is not a change that works. Before reporting
anything done:

1. Run the checks above that the change could plausibly break — not
   only the ones you expect to pass.
2. Run the tests covering the changed behaviour, and add one if none
   existed. A failing test is information: never delete, skip or
   `xfail` one to reach green.
3. Observe the actual system state, not just the exit code — the row
   in the database, the HTTP response, the rendered page, the queued
   job, the audit entry.
4. Say plainly what you did not verify — an unverified claim of
   completion costs more than an honest gap.

## Invariants — do NOT change these without a very good reason

These are load-bearing. Changing them cascades:

- **`backend/src/db/base.py:NAMING_CONVENTION`** — Alembic migration
  determinism depends on it. Touch it and downgrades break across
  machines.
- **`backend/src/services/repositories_async/base.py`** — the
  repository pattern. `AsyncBaseRepository` deliberately exposes no
  ownership-aware read; each user-owned resource declares
  `get_for_user` / `list_for_user` on its own repository (the scaffold's
  `repository.py.tmpl` generates them), so that resource's ownership
  filter lives in ONE place. A router calling `repo.get(...)` or
  `session.get(Model, id)` has bypassed it — an IDOR red flag.
- **`backend/src/api/deps.py`** — `CurrentUserDep` / `AdminDep` / `DBDep`.
  The auth contract. `AdminDep` gates on the email allowlist
  (`project_config.admin_emails`), re-checked per request.
- **`backend/src/startup_guard.py`** — boot-time invariant checks.
  Refuses to start with sentinel secrets / TBD config. Don't weaken
  to "just deploy".
- **Celery serializer = JSON only** (`workers/celery_app.py`). Pickle
  is an RCE vector. Never switch it.
- **`AuditLog` on every privileged action** via
  `services/audit.py:log_action_async`. It's the GDPR Art. 30 surface.

Money, jobs and account lifecycle carry four more. These are the ones
an agent breaks by writing the obvious thing:

- **Credits are an append-only ledger, never a counter column.** Every
  movement is one INSERT into `credit_transactions`; balances are
  derived. A `credits_remaining` column loses races, refunds and the
  audit trail — [`docs/recipes/why-credit-ledger.md`](../production/credits).
- **Every webhook is idempotent.** Paddle retries for days; the
  `processed_webhook_events` + `webhook_events` pair is what makes a
  replay a no-op. Both Paddle and Clerk ride it —
  [`docs/recipes/why-webhook-idempotency.md`](../production/webhook-delivery).
- **Subscription state comes from Paddle**, not from local writes.
  [`docs/recipes/cancel-vs-downgrade.md`](../production/subscription-lifecycle)
  and [`docs/recipes/why-reconciler-limit.md`](../production/async-work).
- **Migrations are additive and reversible.** One per change, a
  working `downgrade()`, no destructive DDL without a documented
  window — [`docs/migrations/safe-migrations.md`](../operating/migrations).
  Account erasure is a real code path, not a DELETE you write by hand:
  `backend/src/workers/account_deletion.py`.

## The `_domain/` convention (buyer code vs factory code)

Buyer-specific code lives in `_domain/` subdirectories; factory code
lives one level up. Upstream owns the `README.md` and `.gitkeep` inside
those directories and may revise them, but it ships no other file there
— so a file **you** create has no upstream counterpart to be overwritten
by. That shrinks the surface an update can collide with; it does not
make updates conflict-free. Every reserved directory:

```
backend/src/models/_domain/          backend/src/api/routers/_domain/
backend/src/services/_domain/        backend/src/workers/tasks/_domain/
backend/src/prompts/_domain/         backend/src/scrapers/_domain/
backend/data/seed/_domain/           frontend/src/components/_domain/
frontend/src/app/[locale]/(dashboard)/(_domain)/
```

The frontend route one is a route **group** — parenthesised. A bare
`_domain/` there is a Next.js *private* folder and never routes, so a
page put in one is silently unreachable.

Protection comes from *where the file lives*, not from the merge: your
files at reserved paths have nothing to reconcile against, while edits
to factory files — including the `_domain/` READMEs, if you change them
— merge like any other change. See
[`docs/recipes/buyer-extension-model.md`](../extending/domain-boundary).

## Where things live (quick map)

```
backend/src/
  api/routers/     one file per resource (account, billing, admin, ...)
  api/deps.py      CurrentUserDep / AdminDep / DBDep
  services/        email, paddle, clerk_webhook, audit, llm/, unsubscribe
  models/          User, Subscription, CreditTransaction, AuditLog, ...
  workers/         celery_app, credit_ledger, reconciler, beat tasks
  middleware/      security_headers, llm_rate_limit
  config/          settings, project, tiers, brand
  startup_guard.py boot-time invariant checks
frontend/src/
  app/[locale]/    locale-prefixed routes (marketing + (dashboard))
  components/      ui/, providers/, banners
  hooks/           use-api, use-clerk, use-utm-capture
docs/              recipes/ + architecture/ + compliance/ + security/
bin/templates/     resource-scaffold (CRUD templates; no generator command)
```

Full architecture: [`docs/architecture/overview.md`](../architecture).

## Style

Match the surrounding code: comment density, naming, idioms. The
codebase favours explicit over clever, boring over novel. Every
non-obvious decision gets a short comment explaining *why*, not *what*.

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `CLAUDE.md`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two, which is what makes naming that version honest.

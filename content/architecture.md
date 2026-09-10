---
title: "Architecture"
description: "What talks to what, why, and at what boundary."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# Architecture

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `docs/architecture/overview.md`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

## Level 1 — System context

```
                                ┌──────────────────┐
                                │   End user       │
                                │   (browser)      │
                                └────────┬─────────┘
                                         │ HTTPS
                                         ▼
                          ┌────────────────────────────┐
                          │   Next.js frontend         │
                          │   (Vercel / Fly)           │
                          │   - Marketing pages        │
                          │   - Auth (Clerk widgets)   │
                          │   - Dashboard              │
                          │   - i18n (next-intl)       │
                          └────────┬───────────────────┘
                                   │ Bearer JWT
                                   ▼
                          ┌────────────────────────────┐
                          │   FastAPI backend          │
                          │   (Fly app process)        │
                          └────┬──────┬──────┬─────────┘
                               │      │      │
                          ┌────▼──┐ ┌─▼──┐ ┌─▼──────┐
                          │ Pg    │ │Red │ │ Celery │
                          │ 16    │ │ is │ │ worker │
                          └───────┘ └────┘ │ + beat │
                                           └────────┘
                                                ▲
                                                │
        ┌───────────────────────────────────────┴───────────────────────────┐
        │                                                                   │
   ┌────▼─────┐  ┌────────┐  ┌─────────┐  ┌──────────┐  ┌─────────────┐  ┌─▼─────┐
   │ Clerk    │  │ Paddle │  │ Resend  │  │ Sentry   │  │ Anthropic / │  │ Other │
   │ (auth)   │  │ (MoR)  │  │ (email) │  │ (errors) │  │ OpenAI      │  │ ext.  │
   └──────────┘  └────────┘  └─────────┘  └──────────┘  │ (LLM)       │  └───────┘
                                                        └─────────────┘
```

Three boxes you run:
- **Frontend** (Next.js, deployable to Vercel or Fly)
- **Backend** (FastAPI app process on Fly)
- **Worker + Beat** (Celery processes on Fly, same Docker image as backend)

Three managed boxes:
- **Postgres 16** (Fly Postgres or managed Neon / RDS)
- **Redis** (Fly Redis or Upstash)
- **External SaaS**: Clerk / Paddle / Resend / Sentry / LLM provider

## Level 2 — Container map

### Frontend (Next.js 16, App Router)

```
app/[locale]/
  (marketing)/              ← static-rendered legal + landing
    privacy / terms / refund / subprocessors / cookies / unsubscribed
  (dashboard)/              ← Clerk-gated
    account/                  GDPR data export + delete
    admin/                    AdminDep-gated; users / metrics / audit / broadcasts
    settings/
  sign-in/ + sign-up/       ← Clerk-hosted widgets
```

Key shared modules:
- `hooks/use-api.ts` — fetch wrapper that injects Clerk Bearer token + request-id correlation.
- `components/providers/utm-provider.tsx` — captures first-touch UTM into localStorage + POSTs to backend once on signup.
- `i18n/routing.ts` — locale prefix routing.
- `lib/utils.ts` — `cn()` for Tailwind merge.

### Backend (FastAPI)

```
src/
  api/
    deps.py                 ← CurrentUserDep / AdminDep / DBDep (Annotated types)
    exceptions.py           ← FabricaError hierarchy → mapped to HTTP codes
    main.py                 ← app factory + middleware stack + router includes
    routers/                ← one file per resource
      account.py              ← /me + Clerk webhook
      admin.py                ← /admin/users + /admin/stats + /admin/audit
      billing.py              ← /billing/checkout + Paddle webhook
      broadcast.py            ← /admin/broadcasts/* (composer)
      email.py                ← /email/unsubscribe (public HMAC)
      feedback.py             ← /feedback (in-app widget)
      _domain/                ← buyer-domain routers (gitignore-style convention)
    schemas/                ← Pydantic request/response models
  models/                   ← SQLAlchemy ORM (one model per file)
    user.py / workspace.py / subscription.py / credit_transaction.py
    audit_log.py / processed_webhook_event.py / webhook_event.py
    api_key.py / feedback.py / broadcast.py
    _domain/                  ← buyer-domain models
  services/                 ← business logic (per-concern files)
    audit.py                  ← log_action_async/sync
    paddle.py                 ← checkout signing + webhook verify
    clerk_webhook.py          ← Svix signature verify
    email.py                  ← Resend wrapper + retry + consent gate
    email_templates.py        ← inline HTML renderers + BROADCAST_REGISTRY
    unsubscribe.py            ← HMAC token gen + verify
    onboarding.py             ← post-signup hook registry
    broadcast_audience.py     ← audience query builder
    disposable_email.py       ← signup blocklist
    repositories_async/       ← typed CRUD layer (AsyncBaseRepository)
  workers/                  ← Celery tasks (one concern per file)
    celery_app.py             ← app instance + beat schedule + Redis TLS
    credit_ledger.py          ← race-safe grant/deduct/refund
    credit_reconciler.py      ← orphan-deduct refund (every 60s)
    subscription_expiry.py    ← downgrade lapsed (hourly)
    account_deletion.py       ← hard-delete 30d+ soft-deleted (daily 04:00 UTC)
    maintenance.py            ← disposable-email blocklist refresh (daily 03:00 UTC)
    broadcast_dispatcher.py   ← one-shot broadcast fanout
  observability/            ← Sentry + structured JSON logs + RequestID middleware
  config/                   ← settings / project / brand / tiers
  db/                       ← Base + session factories + naming convention
  startup_guard.py          ← boot-time invariant assertions
```

## Level 3 — Critical paths

### Signup → first dashboard view

```
Browser → Clerk hosted /sign-up
       → Clerk fires user.created webhook
       → POST /webhooks/clerk
         → verify Svix signature
         → INSERT users row (if absent)
         → AuditLog: user.created
         → fire_on_user_created(db, user)  ← buyer-extension hooks run here
       → Browser redirects to /account
       → GET /api/v1/me  (Clerk JWT in header)
         → CurrentUserDep loads User row
         → returns profile + tier + consent state
       → Browser POSTs cached UTM blob to /api/v1/account/me/signup-metadata
         → idempotent-once
```

### Paid checkout

```
Browser → POST /api/v1/billing/checkout-token
        → backend signs Paddle passthrough (HMAC; tier + user_id baked in)
        → returns token
Browser → opens Paddle checkout widget with token
        → user pays
        → Paddle fires subscription.created webhook
        → POST /webhooks/paddle
          → verify Paddle signature
          → idempotent insert into processed_webhook_events
          → archive raw payload to webhook_events
          → INSERT subscriptions row (or update on _renewed)
          → UPDATE users.current_tier
          → grant_credits via credit_ledger
          → AuditLog: subscription.created
          → enqueue welcome email
```

### Credit deduct (LLM call)

```
Route handler → CurrentUserDep
             → deduct_credits(user_id, amount, job_id)  ← workers.credit_ledger
                 → SELECT ... FROM users WHERE id = :uid FOR UPDATE
                   (row lock, held to end of the caller's transaction —
                    this is what makes check-then-insert atomic)
                 → SELECT SUM(delta) → refuse if it won't cover the spend
                 → INSERT negative-delta row (UNIQUE(job_id, kind) →
                   IntegrityError on a redelivery of the same job)
             → call LLM (Anthropic / OpenAI)
             → on success: nothing (credit already deducted)
             → on failure: credit_reconciler (every 60s) refunds the
               deduct once it has been orphaned for 5 minutes
```

### Email broadcast

```
Admin UI    → POST /admin/broadcasts (template_key + audience + bypass_consent)
            → INSERT broadcast_runs (status=queued)
            → AuditLog: broadcast.queued
            → broadcast_dispatcher.delay(run_id)
Celery worker → _dispatch_async(run_id)
              → status: queued → running
              → resolve audience via build_audience_query
              → filter out broadcast_recipients already in this run (resume)
              → for each user:
                  ├─ render via BROADCAST_REGISTRY
                  ├─ inject unsubscribe footer + headers
                  ├─ send_email_sync (3-retry)
                  └─ INSERT broadcast_recipients (sent | failed)
              → status: running → done | failed
              → AuditLog: broadcast.finished
```

## Boundary contracts

| Boundary | Who speaks first | Auth | Idempotency |
|--|--|--|--|
| Browser → backend API | Browser | Clerk JWT (Bearer) | none (clients retry) |
| Clerk → backend webhook | Clerk | Svix signature | processed_webhook_events |
| Paddle → backend webhook | Paddle | Paddle signature | processed_webhook_events |
| Backend → Resend | Backend | API key | provider_message_id |
| Backend → Anthropic / OpenAI | Backend | API key | none (model_call_id when stream) |
| Backend → Postgres | Backend | DB password | per-txn |
| Celery worker → Redis broker | Worker | Redis password + TLS | task_id + DB-level guards |
| Browser → Paddle checkout | Browser | signed passthrough token | Paddle's |

## Why these splits

- **Frontend / backend split**: lets buyers swap frontend for native mobile later.
- **Worker / API split**: API process never blocks on email send (8.3 req/s ceiling). Workers can scale independently.
- **Repository layer**: centralises ownership filters (single source of truth for IDOR prevention).
- **Schemas separate from models**: client-facing shape diverges from DB schema (e.g. UUIDs as strings for JS).
- **Audit log universal**: every privileged action goes through `log_action_async` — single GDPR Art. 30 surface.

## Tech version pins

| Layer | Version | Reason |
|--|--|--|
| Python | 3.12 | StrEnum stdlib, PEP 695 type params |
| FastAPI | 0.115+ | Annotated deps |
| SQLAlchemy | 2.0 async | Mapped[T] declarative |
| Pydantic | 2.x | model_validator decorator |
| Celery | 5.4+ | task_acks_late stability |
| Next.js | 16 (App Router) | server components defaults |
| Postgres | 16 | gen_random_uuid() native, JSONB perf |
| Redis | 7+ | streams (future-proofing) |

## Receipts

- Container details: `docker-compose.yml` + `Dockerfile` + `fly.toml`
- Beat schedule: `backend/src/workers/celery_app.py:beat_schedule`
- Boundary auth: `backend/src/api/deps.py` + `backend/src/services/{paddle,clerk_webhook,unsubscribe}.py`
- Boot guards: `backend/src/startup_guard.py`
- Naming convention: `backend/src/db/base.py:NAMING_CONVENTION`

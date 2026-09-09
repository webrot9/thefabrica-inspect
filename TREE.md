# Architecture map

**Representative architecture — intentionally incomplete.**

This is a curated view of the private repository, not a listing of it.
Paths shown are real; `…` marks siblings that exist and are not shown.
Its only job is to let you judge whether the system is coherent —
whether billing, metering, workers, compliance and the frontend look
like parts of one design or like features bolted on separately.

```text
backend/
├── src/
│   ├── api/
│   │   ├── main.py                  app assembly, router mounting
│   │   ├── deps.py                  CurrentUserDep / AdminDep / DBDep
│   │   ├── exceptions.py            typed errors → HTTP status mapping
│   │   ├── routers/
│   │   │   ├── account.py           profile, GDPR export/erasure, identity webhook
│   │   │   ├── billing.py           checkout, subscription lifecycle, provider webhook
│   │   │   ├── admin.py             admin surface behind an email allowlist
│   │   │   ├── _domain/             ← buyer routers live here
│   │   │   └── …                    email, feedback, broadcast, …
│   │   └── schemas/
│   │       └── …                    one module per resource
│   ├── models/
│   │   ├── user.py                  identity mirror + consent + attribution
│   │   ├── subscription.py          subscription state mirrored from the provider
│   │   ├── credit_transaction.py    append-only credit ledger
│   │   ├── processed_webhook_event.py   dedup key (provider, event_id)
│   │   ├── webhook_event.py         raw payload archive, separate lifetime
│   │   ├── audit_log.py             privileged-action trail (GDPR Art. 30)
│   │   ├── _domain/                 ← buyer models
│   │   └── …
│   ├── services/
│   │   ├── audit.py                 the one way a privileged action is recorded
│   │   ├── repositories_async/      ownership filtering lives here, in SQL
│   │   │   ├── base.py              get_for_user / list_for_user
│   │   │   └── _domain/             ← buyer repositories
│   │   ├── llm/                     provider clients, caching, streaming
│   │   └── …                        payments, identity, email, unsubscribe
│   ├── workers/
│   │   ├── celery_app.py            JSON-only serializer (pickle is an RCE vector)
│   │   ├── credit_ledger.py         spend / refund / grant movements
│   │   ├── credit_reconciler.py     compensates spends whose work never completed
│   │   ├── account_deletion.py      erasure with a grace window, then hard delete
│   │   └── …                        expiry, monthly grants, maintenance
│   ├── middleware/                  security headers, per-tier LLM rate limiting
│   ├── db/base.py                   naming convention → deterministic migrations
│   ├── config/                      settings, tiers, project, brand
│   └── startup_guard.py             refuses to boot on sentinel secrets / TBD config
├── alembic/versions/                one migration per change, reversible
└── tests/                           unit + integration, ~46 modules
    ├── test_credit_ledger.py        includes the concurrency receipt
    └── …                            IDOR, webhooks, GDPR, billing lifecycle

frontend/
├── src/
│   ├── app/[locale]/                locale-prefixed routing
│   │   ├── (marketing)/             public pages, legal, pricing
│   │   └── (dashboard)/             authenticated app, billing, settings, admin
│   │       └── (_domain)/           ← buyer dashboard surfaces (route group)
│   ├── components/
│   │   ├── ui/                      design-system primitives
│   │   ├── _domain/                 ← buyer components
│   │   └── …                        providers, banners, cookie consent
│   ├── hooks/                       API access, auth, attribution capture
│   ├── config/tiers.ts              the tier matrix the backend also reads
│   └── messages/                    11 locales, incl. RTL
└── e2e/                             golden-path browser test

docs/
├── recipes/                         ~50 "why it is built this way" documents
├── compliance/                      RoPA, DPA, DPIA checklist, breach plan
├── architecture/                    system overview
└── security/                        threat model, incident response
```

## What is deliberately not shown

Implementation of billing and the credit ledger, the compliance
document set, the setup CLI, the canonical scaffold templates, internal
planning material, and the recipes themselves. Filenames appear above
where they help you judge the shape of the system; their contents are
part of the licensed product.

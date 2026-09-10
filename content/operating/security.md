---
title: "Threat model"
description: "OWASP API Top 10 and the GDPR-relevant threats, with residual risk stated."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# Threat model

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `docs/security/threat-model.md`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

This document maps the OWASP API Top 10 + GDPR-relevant threats against
the factory's shipped mitigations. Use it as the substrate for buyer-
specific threat models.

## Trust boundaries

| Boundary | Posture |
|--|--|
| Public internet → frontend | Untrusted. Static-only routes return same content to everyone. |
| Public internet → backend `/health`, `/health/ready`, `/status` | Untrusted and unauthenticated by design. `/health` is liveness only. `/status` always returns 200 and reports per-component `operational` / `degraded` / `down` strings; `/health/ready` returns the same checks with raw exception text and 503 on failure. None of the three exposes a secret. |
| Public internet → backend `/api/v1/*` | Clerk JWT required (Bearer), except `/api/v1/email/unsubscribe`, where the HMAC token in the query string is the authentication. No separate `public` namespace exists under `/api/v1`. |
| Public internet → backend webhook endpoints | Svix (Clerk) or Paddle signature verified per request. |
| Backend ↔ Postgres | TLS optional in dev, REQUIRED in prod via `?sslmode=require`. Credentials via env. |
| Backend ↔ Redis | TLS REQUIRED for `rediss://` URLs with `CERT_REQUIRED` enforced. |
| Backend ↔ external SaaS | TLS 1.2+ enforced by httpx default. API keys via env, never logged. |
| Worker → email send | Same as backend → Resend. |
| Admin user → `/admin/*` | Clerk JWT + email allowlist (`project_config.admin_emails`). No SUDO, no impersonation. |

## OWASP API Top 10 — mitigation map

### API1 — Broken Object Level Authorization (IDOR)

**Threat**: user A fetches `GET /resources/<B's id>` and receives B's data.

**Mitigations**:
- Each user-owned resource gets `get_for_user(id, user_id=...)` / `list_for_user(user_id=...)` on its own repository under `repositories_async/`, and those are the only sanctioned read paths for it. The shared `AsyncBaseRepository` in `repositories_async/base.py` deliberately exposes no ownership-aware read, so a router reaching for `repo.get(...)` or `session.get(Model, id)` is a code-review red flag.
- `bin/templates/resource-scaffold/test.py.tmpl` ships a MANDATORY IDOR regression test that fails CI if the ownership filter is removed.
- Admin endpoints gate on `AdminDep` (allowlist, not role table).
- 404 (not 403) returned for foreign rows — don't leak existence.

**Residual risk**: a buyer who skips the repository pattern can introduce IDOR. The template tests catch it on resources generated from the scaffold; buyer-written-from-scratch resources need their own discipline.

### API2 — Broken Authentication

**Threat**: forged JWT, replay, weak session.

**Mitigations**:
- Clerk owns auth. JWT verification via Clerk JWKS (cached + rotated automatically).
- No password storage in the factory's DB. Reset / 2FA / lockout = Clerk's surface.
- Bearer token expires (default 60s rolling). Refresh via Clerk client SDK.
- Webhook signatures (Svix for Clerk, Paddle's HMAC for billing) verified before any side-effect.

**Residual risk**: Clerk account takeover propagates. Buyers should require 2FA in Clerk settings for admin users.

### API3 — Broken Object Property Level Authorization

**Threat**: PATCH endpoint accepts arbitrary fields including `user_id` / `is_admin` / `current_tier`.

**Mitigations**:
- Pydantic `Update` schemas list only mutable fields explicitly. No `**body.model_dump()` into ORM without allowlist.
- `current_tier` is server-controlled (only Paddle webhook updates it).
- AuditLog `details` use a curated allowlist — no raw body interpolation.

**Residual risk**: buyer adds a field to the model but forgets to remove it from the Update schema. Code review catches this.

### API4 — Unrestricted Resource Consumption

**Threat**: a user spams expensive endpoints (LLM, exports) and racks up bills.

**Mitigations**:
- **Credit ledger** (`workers/credit_ledger.py`) — the deduct takes a `FOR UPDATE` row lock on the spending user before reading the balance, so the check and the INSERT cannot interleave; `UNIQUE(job_id, kind)` separately makes a redelivery of the same job a no-op. A spend the balance will not cover is refused.
- **Rate limiting** on LLM endpoints via Redis (`middleware/llm_rate_limit.py`).
- **Pagination caps**: `GET /admin/users` caps `page_size` at 100, `GET /admin/audit` at 200; both are enforced by FastAPI query validation.
- **Per-user tier limits**: documented in `config/tiers.py`.

**Residual risk**: rate limiters share Redis with the broker. A Redis outage degrades safety until reconnect.

### API5 — Broken Function Level Authorization

**Threat**: a non-admin hits `/admin/*` and gets through.

**Mitigations**:
- `AdminDep` checks email against `project_config.admin_emails` allowlist on EVERY request.
- Allowlist is config (env-injected), not DB — no privilege-escalation DB attack vector.
- Failed admin attempts log `admin.unauthorized` AuditLog rows.

**Residual risk**: a compromised allowlisted email = full admin. Buyers should require 2FA + restrict to corp emails (not personal).

### API6 — Unrestricted Access to Sensitive Business Flows

**Threat**: bot signs up 1000 accounts to abuse free-tier credits.

**Mitigations**:
- Clerk's signup includes email verification (configurable).
- Disposable email blocklist refreshed daily from `disposable-email-domains` (in `workers/maintenance.py`).
- Signup attribution captured (UTM + IP-based country via Clerk).
- Credit grants tied to subscription tier; free-tier grant is fixed + per-account.

**Residual risk**: motivated adversary uses real-looking emails. Not preventable without paid-only model.

### API7 — Server Side Request Forgery (SSRF)

**Threat**: user-controlled URL fetched by backend reaches internal IP.

**Mitigations**:
- Factory makes NO outbound calls based on user-supplied URLs by default.
- LLM provider URLs are config-pinned (Anthropic, OpenAI), not user-controllable.
- Webhook signatures verified — endpoints only respond to Clerk/Paddle origin.

**Residual risk**: buyer features that DO fetch user URLs (scrapers, embedding) need explicit URL allowlisting + private-IP rejection. Not in scope of the factory's shipped code.

### API8 — Security Misconfiguration

**Threat**: defaults leak data (CORS=*, debug=on, no HSTS).

**Mitigations**:
- `middleware/security_headers.py` ships HSTS / CSP / X-Frame-Options / Referrer-Policy / Permissions-Policy defaults.
- CORS is **deny by default**; `settings.cors_origins` (env `CORS_ORIGINS`) must name your real origins. `startup_guard.py:_check_cors_origins` refuses to boot outside development/test if the list still contains a `localhost` / `127.0.0.1` entry left over from `.env.example`.
- `startup_guard.py` runs five checks and refuses boot on the first failure: `project_config` (`company_legal_name` still the `TBD` sentinel), `secrets` (`EMAIL_UNSUBSCRIBE_SECRET` unset or under 32 chars, or `TESTING=1` set in a deployed environment, which would leave the `deps.py` auth bypass reachable), `cors_origins`, `database` and `redis`.
- `.env` template has commented sentinels — real values must be set.
- Sentry runs with `send_default_pii=False`, so request headers, cookies and user identifiers are not attached to events.

### API9 — Improper Inventory Management

**Threat**: a forgotten staging endpoint with weak auth leaks data.

**Mitigations**:
- `/docs` (Swagger) disabled in production (`settings.environment != "production"`).
- `/api/v1/admin/*` paths gated on AdminDep.
- No `/debug/*` endpoints shipped.
- The router surface is documented + easy to audit "what's exposed".

### API10 — Unsafe Consumption of APIs

**Threat**: upstream API returns malicious payload, backend trusts it.

**Mitigations**:
- Pydantic validates EVERY external API response (Paddle webhook body, Clerk webhook body, LLM JSON outputs).
- HTTPx default timeout (30s) prevents indefinite hangs.
- Retry logic exponential-backoff capped at 3 attempts.

## GDPR-relevant threats

### Right to erasure (Art. 17)

**Threat**: user deletes account; some row somewhere retains their PII.

**Mitigations**:
- `User` rows have FK CASCADE on every user-owned table (see naming-convention test).
- Soft delete + 30-day grace via `users.deleted_at`; hard delete in `workers/account_deletion.py`.
- `broadcast_recipients`, `feedback`, `audit_logs` use `ON DELETE SET NULL` to preserve operational records WITHOUT the user_id link.
- AuditLog event `user.hard_deleted` written before the DELETE — proves the action.

**Residual risk**: buyer adds a user-data table without FK CASCADE. The scaffold template encodes this; manual additions need code review.

### Right of access (Art. 15) + portability (Art. 20)

**Threat**: user requests their data; provider can't produce it.

**Mitigations**:
- `GET /api/v1/account/me/export` returns a JSON bundle of every user-linked table.
- AuditLog query exposed in same response (Art. 15 right to see processing log).

### Marketing consent (ePrivacy + GDPR Art. 7)

**Threat**: marketing email sent without opt-in.

**Mitigations**:
- `marketing_consent_given` on User; gate enforced in `send_marketing` + `build_audience_query`.
- Broadcast router double-gate: `kind="marketing"` + `bypass_consent=True` → 409.
- `marketing_consent_at` + `marketing_consent_source` audit-recorded.
- RFC 8058 `List-Unsubscribe-Post` headers on every marketing send.
- Public `GET`/`POST /api/v1/email/unsubscribe?t=<HMAC>` for one-click unsubscribe.

### Data minimisation (Art. 5(1)(c))

**Threat**: collect PII we don't need.

**Mitigations**:
- User row stores: clerk_user_id, email, current_tier, consent flags, signup UTMs, locale. NO name, NO phone, NO address.
- AuditLog `details` JSONB is curated allowlist (no raw bodies).
- Sentry runs with `send_default_pii=False`.

### Cross-border transfers (Schrems II)

**Threat**: EU user data transferred to US sub-processor without safeguards.

**Mitigations**:
- Default region: `fra` (Frankfurt) for Fly Postgres + Redis.
- Clerk: SCCs in their DPA (EU residency option available).
- Paddle: Merchant of Record + SCCs; user data stays in EU on the EU plan.
- Resend: SCCs; EU-only plan available.
- Sentry: EU-only project endpoint available (`https://o…ingest.de.sentry.io`).
- Subprocessors list at `/subprocessors` route.

## Logging + monitoring posture

| What | Where | Retention |
|--|--|--|
| HTTP access logs | stdout (JSON) → Fly log aggregation | 30 days (default Fly) |
| Application errors | Sentry | 90 days (configurable) |
| AuditLog (privileged actions) | Postgres `audit_logs` | INDEFINITE (legal requirement) |
| Webhook archive | Postgres `webhook_events` | 90 days (default; buyer-tunable) |
| Email send events | AuditLog (action=email.sent / email.skipped) | INDEFINITE |
| Paddle payment data | Paddle's systems, not ours | Paddle policy (typically 7 years) |
| Background task status | Celery result backend (Redis) | 24 hours |

## Incident response hooks

1. **Sentry alerts** wired to email + Slack via Sentry's UI.
2. **Webhook failures** logged with `action=webhook.failed` and visible in admin audit viewer.
3. **`/status` endpoint** is public and unauthenticated, and reports per-component status strings. `/health/ready` returns the same checks with raw error detail. Both cover Postgres, Redis and ChromaDB; external SaaS (Clerk, Paddle, Resend) is deliberately not probed, so one vendor outage cannot pull every replica out of rotation.
4. **Boot guards** (`startup_guard.py`) refuse to start with sentinel config — prevents accidental prod boot of dev image.

## Cryptography in use

| Use | Algorithm | Key source |
|--|--|--|
| HTTPS termination | TLS 1.3 / 1.2 | Fly platform / Vercel |
| Clerk JWT verify | RS256 | Clerk JWKS |
| Paddle webhook verify | HMAC-SHA256 | PADDLE_WEBHOOK_SECRET env |
| Clerk webhook verify | HMAC-SHA256 (Svix) | CLERK_WEBHOOK_SECRET env |
| Email unsubscribe token | HMAC-SHA256 | EMAIL_UNSUBSCRIBE_SECRET env |
| Paddle checkout passthrough | HMAC-SHA256 | PADDLE_WEBHOOK_SECRET env (reused deliberately — no separate checkout secret exists) |
| Database connection | TLS to Postgres | Postgres cert |
| Redis connection (prod) | TLS to Redis | Redis cert + verify mode |

NO custom crypto. All HMAC keys ≥ 32 bytes via `secrets.token_urlsafe(32)`.

## Known gaps + buyer responsibilities

These are **not** mitigated by the factory; buyers must address:

1. **Web Application Firewall**: not shipped. Add Cloudflare in front of Vercel/Fly for L7 DDoS + bot management.
2. **CSP nonce per request**: factory ships static CSP. For inline scripts you need nonce injection.
3. **SOC2 controls** beyond technical: vendor management, access reviews, change management — process, not code.
4. **Penetration testing**: arrange annually with a qualified vendor.
5. **Disaster recovery drill**: `DEPLOY.md § Backups` documents the WHAT; the drill is on the buyer.
6. **Bug bounty**: not shipped; buyers should publish a security.txt with contact.
7. **Subprocessor changes**: factory's defaults are baseline. Adding (e.g.) Mixpanel means updating `/subprocessors` route + DPA.

## Receipts

- Security headers: `backend/src/middleware/security_headers.py`
- Auth deps: `backend/src/api/deps.py`
- Boot guards: `backend/src/startup_guard.py`
- HMAC services: `backend/src/services/{unsubscribe,paddle,clerk_webhook}.py`
- AuditLog: `backend/src/services/audit.py` + `backend/src/models/audit_log.py`
- Webhook idempotency: `backend/src/models/processed_webhook_event.py`
- Naming convention test: `backend/tests/test_db_naming_convention.py` (constraint/index naming only — nothing currently asserts FK cascade discipline; the scaffold template encodes it and code review is the control)
- IDOR regression: `bin/templates/resource-scaffold/test.py.tmpl`

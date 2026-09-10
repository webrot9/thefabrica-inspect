---
title: "Three health endpoints, three purposes"
description: "Liveness, readiness and a public component matrix \u2014 and what none of them check."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica v0.1.2 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# Three health endpoints, three purposes

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

The factory ships three GET endpoints under `/`:

| Endpoint | Purpose | Auth | Latency | Use case |
|----------|---------|------|---------|----------|
| `/health` | Liveness | none | <1ms | kubelet livenessProbe, Fly health check, uptime monitor |
| `/health/ready` | Readiness | none | <3s | kubelet readinessProbe, deploy verification |
| `/status` | Public component matrix | none | <3s | Embedded status widget, status.&lt;domain&gt; subdomain |

Each addresses a distinct operational question. Pointing the wrong
monitor at the wrong endpoint is a common foot-gun.

## `/health` — liveness only

Returns 200 immediately as long as the Python process is running.
No DB call, no Redis call, no external check.

```bash
curl https://api.<domain>/health
# {"status":"ok","project_slug":"...","environment":"production"}
```

**Use this for**:
- Fly.io health checks (`[[http_service.checks]]` in fly.toml).
- kubelet livenessProbe (`failureThreshold: 3` → pod restart).
- External uptime monitor (UptimeRobot / BetterStack / Pingdom).
- Load balancer is-this-host-alive test.

**Don't use this for**:
- Deploy gate ("is the new pod ready to serve traffic?"). Use
  `/health/ready` instead — `/health` is green even when the DB
  is unreachable.

## `/health/ready` — readiness with raw detail

Same body shape as `/health` but with parallel checks against DB,
Redis, ChromaDB. Returns 200 if all pass, **503** if any fails.

```bash
curl https://api.<domain>/health/ready
# {
#   "ok": false,
#   "checked_at": "2026-05-12T10:00:00+00:00",
#   "checks": [
#     {"name": "database", "ok": true, "message": "...", "latency_ms": 8},
#     {"name": "redis", "ok": false, "message": "ConnectionRefusedError: ...", "latency_ms": 3001}
#   ]
# }
```

Raw exception messages on failure — useful for `kubectl describe pod`
output + on-call debugging.

**Use this for**:
- kubelet readinessProbe (`failureThreshold: 2` → pod removed from
  service).
- Deploy verification (CI: `curl /health/ready` after release; fail
  if 503).
- Pre-traffic gate on rolling deploys.

**Don't use this for**:
- Public status page. The raw messages leak too much (database
  host, port, connection-pool internals).

## `/status` — public component matrix

Three-state per component (`operational` / `degraded` / `down`); no
exception traces. Always 200; the client renders the per-component
status.

```bash
curl https://api.<domain>/status
# {
#   "project": "production",
#   "checked_at": "2026-05-12T10:00:00+00:00",
#   "overall": "degraded",
#   "components": [
#     {"name": "database", "status": "operational"},
#     {"name": "redis", "status": "degraded"},
#     {"name": "chromadb", "status": "operational"}
#   ]
# }
```

`degraded` = check passed but latency > 500ms. Buyers tune the
threshold per-component if they want stricter SLAs.

**Use this for**:
- Embedded status widget on the marketing page ("System status:
  operational").
- Public `status.<domain>` subdomain — point a static React app at
  this endpoint, render the matrix.
- Customer-visible incident communications.

## What's NOT checked

External SaaS (Clerk, Paddle, Resend) are deliberately not in
`/health/ready` because:
- They have their own public status pages.
- A transient external outage pulling every API replica out of
  rotation cascades into a self-inflicted full outage.

If a buyer wants to surface external state on `/status`, the
extension hook is in `observability/health.py:_run_all_checks` —
add a check that reads the external service's status JSON (e.g.
`https://clerk.statuspage.io/api/v2/status.json`).

## Receipts

- Module: `backend/src/observability/health.py`
- Routes: `backend/src/api/main.py` (lines containing
  `/health`, `/health/ready`, `/status`).
- Tests: `backend/tests/test_status_routes.py`

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `docs/recipes/health-and-status.md`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two — the exporter refuses to name a product version otherwise.

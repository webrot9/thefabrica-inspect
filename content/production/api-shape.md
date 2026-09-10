---
title: "One endpoint per screen"
description: "A fat dashboard endpoint against a request per card."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# One endpoint per screen

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `docs/recipes/single-call-metrics-overview.md`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

`GET /api/v1/admin/metrics/overview` returns every number the admin
dashboard renders — revenue, mailing health, DAU/WAU/MAU, acquisition,
lead-magnet funnel — in a single response. Not five separate
endpoints. Single round trip.

## What competitors ship

Often: one endpoint per "card" on the dashboard.

```
GET /admin/mrr
GET /admin/dau
GET /admin/wau
GET /admin/mau
GET /admin/signups
GET /admin/churn
GET /admin/mailing-funnel
```

Frontend issues 7 fetches in `useEffect`. Network waterfall. Loading
spinners that pop in / out per card. Stuck cards if any one endpoint
slows down. SSR-friendly? No (7 parallel requests, all of which can
fail independently).

## What we ship

```python
@router.get("/metrics/overview", response_model=AdminMetricsOverviewResponse)
async def metrics_overview(...) -> AdminMetricsOverviewResponse:
    revenue = await _compute_revenue_snapshot(db)
    mailing = await _compute_mailing_health(db, thirty_days_ago=...)
    activity = await _compute_activity_metrics(db, ...)
    acquisition = await _compute_acquisition(db, ...)
    lead_magnet = await _compute_lead_magnet_funnel(db, ...)
    return AdminMetricsOverviewResponse(revenue=..., mailing=..., ...)
```

One endpoint, five helpers. Each helper runs 2-4 small queries
against indexed columns. P99 latency is dominated by the slowest
sub-query, not their sum.

## Why one, not five

1. **Frontend is simpler.** One fetch, one loading state, one error
   boundary. The dashboard shows skeletons everywhere or all the
   real numbers — never the broken-middle state.
2. **Network is faster.** TCP / TLS / Clerk JWT verification is a
   per-request cost. Five requests = 5× that overhead. One request
   amortises it across the full payload.
3. **Caching is easier.** Add `Cache-Control: max-age=60` on this
   endpoint → 60 seconds of CDN cache for the entire dashboard. Per-
   endpoint caching requires a TTL per surface area + invalidation
   logic per metric.
4. **The metrics are correlated.** If you're showing them on the
   same dashboard, you probably want them computed against the same
   `now()`. Five endpoints means five different "now" calls — the
   user sees "30 signups last 30d / 31 active subs" because one card
   was a second behind the next. One endpoint, one `datetime.now()`.

## When you'd split

Split when **one** of the metrics has fundamentally different update
semantics:
- A real-time "currently-online users" counter that updates every 5s
  → don't bundle it with the daily-revenue snapshot.
- A heavy aggregation (cohort retention over 12 months) that takes
  10s to compute → don't make the whole dashboard wait. Split that
  one out + show "Loading cohort..." while the rest is hydrated.

The factory's metrics overview is bundled because all of them are
"recent snapshot" queries — small, indexed, fast.

## Implementation details worth pinning

- **`USER_PROVENANCE_PREFIXES` extension hook**. Lead-magnet metrics
  are zero-safe when the prefix dict is empty (factory default).
  Buyers with a lead-magnet flow add `{"lead_magnet": "lead-magnet:"}`
  to project_config and the funnel populates.
- **Out-of-scope flags**. Time-series MRR + CAC/LTV aren't in this
  endpoint. Documented as recipes (`admin-metrics-time-series.md`)
  because they need additional storage (daily snapshots / ad-spend
  ingest) that isn't factory boilerplate.
- **`generated_at` field**. Lets the frontend show "Last updated:
  2 minutes ago" instead of always rendering "live". With a 60s
  cache, the freshness is bounded by the cache TTL.

## Receipts

- Endpoint: `backend/src/api/routers/admin.py:metrics_overview`
- Helpers: `backend/src/api/routers/admin.py:_compute_*`
- Schema: `backend/src/api/schemas/admin.py:AdminMetricsOverviewResponse`
- Extension hook: `backend/src/config/project.py:user_provenance_prefixes`

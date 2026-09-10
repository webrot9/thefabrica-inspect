---
title: "Cost baseline"
description: "What the third-party stack costs, by scale, and where the factory does not help."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# Cost baseline

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `docs/cost-baseline.md`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

All prices in USD as of May 2026. They drift; treat as orders of magnitude.

## Stage 0 — Development (you, alone, building)

| Service | Tier | Monthly |
|--|--|--|
| Cursor or Claude Code | Pro | $20 |
| Anthropic API (Claude Code's calls) | Usage-based | $30-150 |
| Fly.io | Free tier | $0 |
| Clerk | Free (≤10k users) | $0 |
| Paddle | Sandbox | $0 |
| Resend | Free (3k emails/mo) | $0 |
| Sentry | Developer plan | $0 |
| Cloudflare (domain + DNS) | Free | $10/year ÷ 12 ≈ $1 |
| **Total** | | **$51-171/month** |

The variance is mostly Anthropic API spend. Active development weeks
hit the high end; review weeks the low end. Don't be surprised if
your first month is $200 while you're learning to prompt efficiently.

## Stage 1 — Launch (0-100 active users)

You're live. A few customers. Mostly free-tier or trial-tier.

| Service | Tier | Monthly |
|--|--|--|
| Fly.io app process | shared-cpu-1x 256MB | ~$2 |
| Fly.io worker process | shared-cpu-1x 256MB | ~$2 |
| Fly.io beat process | shared-cpu-1x 256MB | ~$2 |
| Fly.io Postgres | shared-cpu-1x 10GB | ~$13 |
| Fly.io Redis (or Upstash) | Smallest tier | $0-10 |
| Clerk | Free or Hobby | $0-25 |
| Paddle | 5% + $0.50 per transaction | usage-based |
| Resend | Free or Pro | $0-20 |
| Sentry | Developer | $0 |
| Anthropic API (if LLM-using product) | usage-based | varies |
| Domain | $10/year | ~$1 |
| Cloudflare | Free | $0 |
| **Fixed infra** | | **$20-75/month** |

Paddle takes a slice of revenue (5% + $0.50 standard). Anthropic costs
depend on your product — a SaaS that calls Claude per user request
adds up; a SaaS that calls Claude rarely doesn't.

## Stage 2 — Growing (100-1000 active users)

Some paid customers. Email volume + DB load picking up.

| Service | Tier | Monthly |
|--|--|--|
| Fly.io app process | shared-cpu-1x 512MB ×2 | ~$10 |
| Fly.io worker process | shared-cpu-1x 512MB ×2 | ~$10 |
| Fly.io beat process | shared-cpu-1x 256MB | ~$2 |
| Fly.io Postgres | shared-cpu-1x 40GB + replica | ~$50 |
| Fly.io Redis | Upstash Pay-as-you-go | ~$10-30 |
| Clerk | Hobby / Pro | $25-99 |
| Paddle | 5% + $0.50 per transaction | usage-based |
| Resend | Pro | $20 |
| Sentry | Team | $26 |
| Anthropic API | usage-based | varies |
| Cloudflare | Free | $0 |
| **Fixed infra** | | **$153-246/month** |

At this stage you start seeing the first scaling pinch points. Common
ones:

- **Postgres CPU**: a non-indexed query starts trending up. Add the
  index, you're back to normal.
- **Resend deliverability**: domain reputation matters. Warm up sender
  domains gradually.
- **Sentry quota**: too many events. Filter noisy errors in
  `sentry.beforeSend`.

## Stage 3 — Established (1000-10000 active users)

You have meaningful revenue. Time to actually run production-grade.

| Service | Tier | Monthly |
|--|--|--|
| Fly.io app process | performance-2x ×2 | ~$60 |
| Fly.io worker process | performance-2x ×2 | ~$60 |
| Fly.io beat process | shared-cpu-1x 256MB | ~$2 |
| Fly.io Postgres | dedicated-cpu-2x 80GB + replica | ~$200 |
| Fly.io Redis (HA) | Upstash Pro | ~$80 |
| Clerk | Pro | $99 |
| Paddle | 5% + $0.50 per transaction | usage-based |
| Resend | Pro | $20-90 (volume tier) |
| Sentry | Team | $26-80 |
| Anthropic API | usage-based | $500-5000+ |
| Cloudflare | Pro (WAF + bot mgmt) | $20 |
| **Fixed infra** | | **$567-781/month** |

LLM is now your biggest line item by far. Cache aggressively (the
factory ships `services/llm/cache.py` — use it). Tier-gate LLM-heavy
features behind paid plans.

## Stage 4 — Scale (10000+ users)

You're past startup. Hire a real DevOps. The factory's defaults are
no longer optimal — switch to managed Kubernetes / proper Postgres
replicas / CDN for assets / dedicated email IPs.

Budget: **$2000+/month fixed infra**, plus LLM spend that can be
$10k+/month depending on usage.

If you're here and didn't expect it, this is the inflection point
to STOP optimising costs and START hiring.

## Per-component cost drivers

### Postgres

- **Storage**: webhook_events grows fast (~1 row per webhook delivery).
  Set up retention via `workers/maintenance.py` — drop rows > 90 days.
- **CPU**: composite indexes are your friend. The factory's
  `(user_id, created_at)` pattern keeps "my latest X" queries fast.
- **Replicas**: add a read replica when read load > 70% CPU.

### Redis

- **Memory**: Celery task results expire after 24h (factory default).
  Don't lower the TTL — debugging needs the trace.
- **Connections**: each worker process holds a pool. If you scale to
  many workers, watch connection count.

### Resend

- **Volume**: pricing tiers at 50k / 100k / 500k emails. Marketing
  broadcasts can spike you up a tier. Check before sending.
- **Sender domains**: separate `transactional@` from `marketing@`
  domains for reputation isolation. Resend supports this.

### Anthropic API

- **Caching**: factory's `llm/cache.py` keys by prompt+model+params.
  Hit rates of 30-60% on user-facing queries are normal.
- **Model selection**: Haiku for simple tasks, Sonnet for most,
  Opus only when truly needed. 10× price difference between Haiku and Opus.
- **Token budgeting**: track via Sentry breadcrumbs (factory wires
  this). Set per-tier daily caps.

### Sentry

- **Events**: free tier is 5k/mo. A noisy app burns this in days.
  Filter expected exceptions (e.g. user-cancelled requests).
- **Performance traces**: 10% sample rate is plenty for most products.
  Factory default.

### Clerk

- **MAU**: pricing scales with monthly active users. Free up to 10k
  MAU. Hobby tier $25 covers smaller features; Pro $99 covers SSO etc.
- **Organisations**: if you use Clerk's org feature for B2B, it's
  per-org pricing. Plan accordingly.

## Where the factory doesn't help on costs

- **LLM spend** — your prompts, your problem. Cache + tier-gate.
- **Paddle's cut** — every payment processor takes 3-5%. Paddle is
  not the cheapest, but you save the VAT-handling cost.
- **Custom integrations** — every new SaaS you bolt on is its own line.

## Forecasting

Quick formula for monthly run rate at N active users:

```
Fixed:        $20 + $0.50 × N        (infra + per-user-ish DB load)
Email:        $0.0002 × emails_sent
LLM:          $0.05 × LLM_calls       (rough; varies wildly by model)
Clerk:        $0 (≤10k) or $99 (>10k)
Paddle cut:   5% × revenue
Sentry:       $26 above ~5k events/mo
```

At 1000 users sending 5k emails and 20k LLM calls per month with
$5k revenue:
```
$20 + $500 + $1 + $1000 + $99 + $250 + $26 = ~$1900/mo
```

Most of that is LLM. Tune your cache hit rate and you can halve it.

## When to optimise

In order:

1. **<$100/mo costs**: don't optimise. Build product.
2. **$100-500/mo**: spot-check Postgres slow queries + LLM caching.
3. **$500-2000/mo**: real cost review monthly. Tier-gate aggressively.
4. **>$2000/mo**: hire a part-time DevOps consultant. Pay $1k for 2hrs
   of review and save $5k/mo.

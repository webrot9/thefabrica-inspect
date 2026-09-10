---
title: "Webhook delivery is idempotent by construction"
description: "At-least-once delivery, and the two-table pattern that absorbs it."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Extracted from The Fabrica v0.1.2.
     Edits belong in the product documentation, not here. -->

# Webhook delivery is idempotent by construction

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

Every webhook the factory receives is idempotent: replay the same
event 10 times → exactly one side effect. The two-table pattern
(`processed_webhook_events` + `webhook_events`) is the load-bearing
invariant; both Paddle and Clerk webhooks ride it.

## The competitor pattern

```python
# competitor/billing.py
@app.post("/webhooks/paddle")
async def paddle_webhook(payload: dict):
    if payload["event_type"] == "subscription.created":
        await grant_credits(payload)
    return {"ok": True}
```

No dedup. No archive. Trust the payload.

## Where it breaks

Paddle's webhook retry policy: **up to 25 retries over 3 days** on
any non-2xx response (and "non-2xx" includes "TCP RST mid-response").
Clerk uses Svix → same 5xx retry semantics.

Real failure modes the competitor pattern hits:

1. **TCP reset post-2xx**. Server processes the event, commits the DB
   transaction, writes the 200 OK response → and the TCP ACK packet
   gets dropped (NAT timeout, load balancer keepalive expiry, mobile
   network blip). Paddle marks the delivery as failed + retries 15
   min later. The handler runs again. Credits granted twice.
2. **Worker timeout mid-process**. The handler is 30s into a heavy
   `subscription.created` flow when the LB times out the request.
   The DB transaction is mid-commit; the response is 504. Paddle
   retries. Handler runs again. State half-applied + replayed.
3. **Deploy-mid-webhook**. You deploy. Mid-deploy a worker that's
   been processing a webhook for 10s gets SIGTERM. The handler is
   killed before commit. Paddle retries. New deploy's handler picks
   it up fresh. Looks fine — but if you don't have idempotency, a
   stuck-retry that suddenly succeeds 12 hours later DOES grant
   credits twice if the first run actually completed its DB commit
   but failed to ACK.

The cost is real — the failure modes this guards against: duplicate
credit grants, duplicate welcome emails, and duplicate
`subscription.cancelled` handlers (downgrading users twice → a support
nightmare).

## What we ship

Two tables. One job each.

**`processed_webhook_events`** (the dedup):
```sql
CREATE TABLE processed_webhook_events (
    id UUID PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_processed_webhook_events_provider_event_id
        UNIQUE (provider, event_id)
);
```

The UNIQUE constraint is the dedup. On every webhook delivery, we
INSERT first. Postgres enforces the uniqueness atomically. If the
INSERT trips IntegrityError, the event was already processed — we
rollback the dedup attempt, mark the archive row SKIPPED, return 200
with `idempotent: true`. Zero downstream side effects.

**`webhook_events`** (the archive):
```sql
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL,
    signature TEXT,
    processing_status VARCHAR(32) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Every payload + signature stored unconditionally. The
`processing_status` column tracks PENDING / PROCESSED / SKIPPED /
FAILED so a buyer doing forensics can `SELECT * WHERE
processing_status='FAILED' AND created_at > NOW() - INTERVAL '1 day'`
and see what's broken.

The handler shape:
```python
@router.post("/webhook")
async def paddle_webhook(request, db, paddle_signature):
    raw_body = await request.body()
    payload = verify_paddle_signature(raw_body, paddle_signature, secret)

    archive = WebhookEvent(provider="paddle", event_id=..., payload=payload, ...)
    db.add(archive)
    await db.flush()

    idem = ProcessedWebhookEvent(provider="paddle", event_id=event_id, ...)
    db.add(idem)
    try:
        await db.flush() # ⬅ UNIQUE constraint fires here on replay
    except IntegrityError:
        await db.rollback()
        archive.processing_status = "SKIPPED"
        return {"event_id": event_id, "idempotent": True}

    # First-delivery path: process the event, mark archive PROCESSED
    await _handle_event(db, payload)
    archive.processing_status = "PROCESSED"
    return {"event_id": event_id}
```

## Why two tables, not one

The dedup table is **small + hot** (one row per event, indexed). The
archive is **large + cold** (full payload + signature + error
messages, queried for forensics maybe once a week).

Splitting:
- Dedup table fits in shared_buffers → INSERT-on-conflict is ~µs.
- Archive can grow to GBs without hurting dedup latency.
- Buyers retention-purge the archive after 90 days; the dedup keeps
  forever (each row is ~80 bytes).

One table would force a trade-off: either you keep the archive
forever (storage cost), or you purge it + lose dedup for replays
that arrive after the purge window.

## Replay protection vs idempotency

These are two layers:

- **Replay protection** (in `services/paddle.py`): rejects requests
  with timestamps > 5 minutes old via constant-time HMAC compare.
  Stops attackers who captured a webhook payload + replay it from a
  different IP days later.
- **Idempotency** (this recipe): handles legitimate replays (Paddle
  retries within the 3-day window) that pass signature + timestamp
  but were already processed.

Both layers are needed. Signature-only catches forgeries; idempotency
catches the dups.

## What about Stripe / Clerk?

Same pattern works for any provider that:
1. Emits a stable `event_id` per delivery (Stripe: `evt_*`, Clerk:
   `svix-id` header, Paddle: `event_id` in the body).
2. Retries on non-2xx.

The factory ships handlers for Paddle + Clerk. Buyers adding a third
(Twilio, SendGrid, GitHub webhook) drop into the same two-table
pattern by reusing `WebhookEvent` + `ProcessedWebhookEvent` with a
new `provider` enum value.

## Receipts

- Idempotency model: `backend/src/models/processed_webhook_event.py`
- Archive model: `backend/src/models/webhook_event.py`
- Paddle handler: `backend/src/api/routers/billing.py:paddle_webhook`
- Clerk handler: `backend/src/api/routers/account.py:clerk_webhook`
- Replay protection: `backend/src/services/paddle.py:verify_paddle_signature`

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `docs/recipes/why-webhook-idempotency.md`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two, which is what makes naming that version honest.

# Why webhook handling is idempotent by construction

A payment or identity provider will deliver the same event to you more
than once. Not because something is broken — because at-least-once
delivery is the only guarantee a sender can offer over an unreliable
network. Any provider that retries on a non-2xx response will
eventually retry a request your server actually processed.

The naive handler assumes each delivery is new:

```python
@app.post("/webhooks/provider")
async def handler(payload: dict):
    if payload["event_type"] == "subscription.created":
        await grant_credits(payload)
    return {"ok": True}
```

Replay that event and the customer gets the credits twice.

## Why a duplicate delivery is normal

The failure does not require the provider to misbehave. It requires
only that the *acknowledgement* fail while the *work* succeeds:

- The handler commits its transaction, writes `200 OK`, and the
  response is lost on the way back — a NAT timeout, a load balancer
  dropping a keepalive, a mobile network blip. The sender sees a failed
  delivery and retries. The work already happened.
- The handler is most of the way through a slow event when the load
  balancer times the request out. The client sees `504`. The
  transaction may or may not have committed.
- A deploy sends `SIGTERM` to a worker mid-event. The sender retries
  against the new release.

In each case the sender is behaving correctly and the receiver has no
way to distinguish "you never got this" from "you got it and could not
say so". That ambiguity is the sender's to resolve by retrying, and the
receiver's to resolve by being idempotent. Wanting exactly-once
delivery does not make it available.

The consequences are the kind that reach a human: credits granted
twice, a welcome email sent twice, a cancellation applied twice.

## The shape we ship

Two tables, each with one job.

**Deduplication** — small, hot, and the actual guard:

```sql
CREATE TABLE processed_webhook_events (
    id           UUID PRIMARY KEY,
    provider     VARCHAR(32)  NOT NULL,
    event_id     VARCHAR(255) NOT NULL,
    event_type   VARCHAR(128) NOT NULL,
    processed_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (provider, event_id)
);
```

**Archive** — large, cold, and for forensics:

```sql
CREATE TABLE webhook_events (
    id                UUID PRIMARY KEY,
    provider          VARCHAR(32)  NOT NULL,
    event_id          VARCHAR(255) NOT NULL,
    event_type        VARCHAR(128) NOT NULL,
    payload           JSONB        NOT NULL,
    signature         TEXT,
    processing_status VARCHAR(32)  DEFAULT 'pending',
    error_message     TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

The handler archives the raw payload unconditionally, then attempts the
dedup insert *before* doing any work. The uniqueness violation is the
signal:

```python
archive = WebhookEvent(provider=..., event_id=..., payload=payload)
db.add(archive)
await db.flush()

db.add(ProcessedWebhookEvent(provider=..., event_id=event_id))
try:
    await db.flush()          # uniqueness is enforced here
except IntegrityError:
    await db.rollback()
    archive.processing_status = "SKIPPED"
    return {"event_id": event_id, "idempotent": True}

await handle_event(db, payload)
archive.processing_status = "PROCESSED"
```

The guarantee comes from a database constraint, not from application
logic remembering to check. Two concurrent deliveries of the same event
race into the same unique index and exactly one wins. A `SELECT` before
an `INSERT` would leave a window between them; this has none.

## Why the event id must come from the provider

Deduplication needs a key that is stable across retries of the same
event and distinct between different events. That key has to be the
provider's own event identifier. A hash of the payload is not a
substitute: two genuinely distinct events can be byte-identical, and
some providers vary metadata between retries of one event. Every
provider worth integrating emits such an identifier.

## Why two tables and not one

The dedup row is tiny and read on every delivery; the archive row
carries a full payload and is read rarely. Splitting them keeps the hot
path small while the archive grows.

It also lets the two have different lifetimes, which is the substantive
reason. Archived payloads are personal data under GDPR and should be
purged on a retention schedule. Dedup rows are a few bytes and must
outlive any window in which a replay could arrive. One table would force
a choice between keeping payloads longer than their retention policy
allows and losing replay protection when you purge.

## Idempotency is not replay protection

Two different layers, often confused:

- **Signature and timestamp verification** rejects forged or captured
  requests: a constant-time comparison against the signing secret, and
  a bound on how old a request may be. This is a security control.
- **Idempotency** handles deliveries that are entirely legitimate —
  correctly signed, recently sent, and already processed.

Signature checking alone accepts a replayed valid request. Idempotency
alone accepts a forgery. Both are needed, and neither substitutes for
the other.

## Portability

Nothing above is provider-specific. It needs a stable event id per
event and retries on non-2xx, which describes essentially every payment
and identity provider. Adding one is a new value in the provider
column, not a new mechanism.

This document deliberately states no retry counts or retry windows.
Those are provider policy, they change, and the argument does not
depend on them: the design has to be correct for one duplicate
delivery, whenever it arrives.

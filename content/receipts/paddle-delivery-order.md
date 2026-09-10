---
title: "Two events, no delivery order"
description: "What a real sandbox purchase showed about concurrent webhooks, and the defect it exposed."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Extracted from The Fabrica v0.1.2.
     Edits belong in the product documentation, not here. -->

# Two events, no delivery order

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

The two no-trial first purchases this guide was written from each produced
three events. One of those runs looked like this:

```
occurred_at                 event_type                status
2026-…T09:14:51.833881      subscription.created      delivered
2026-…T09:14:51.833881      subscription.activated    delivered
2026-…T09:14:52.252546      transaction.completed     delivered
```

Read that first column carefully. In both executed runs
**`subscription.created` and `subscription.activated` carried the identical
`occurred_at`** and were delivered concurrently — and across the two
payments they arrived and were processed in *opposite orders*, `created`
first on one and `activated` first on the other.

Two runs are not a contract, so do not read the timestamps above as one.
What they do establish is the part that matters: these events **can** arrive
concurrently, and **no delivery order should be assumed**. Your own account,
plan configuration and trial settings may produce a different sequence
again. A handler that assumes `created` lands first is relying on something
nobody has promised it; see
[What this run fixed](#what-this-run-fixed).

## What this run fixed

Driving this against a real Paddle sandbox exposed one product defect that
no test and no amount of reading had caught.

**Concurrent first-purchase deliveries failed one of their own webhooks.**
`_upsert_subscription_row` read the subscription by `paddle_subscription_id`
and inserted when it found nothing. In the first executed run
`subscription.created` and `subscription.activated` arrived concurrently, so
both requests read "no row" before either committed, and the loser violated
`uq_subscriptions_paddle_subscription_id`:

```
subscription.activated  failed  IntegrityError: duplicate key value violates
                                unique constraint
                                "uq_subscriptions_paddle_subscription_id"
```

The system converged anyway — but only because Paddle retried 20 seconds
later. Nothing guarantees that retry once delivery attempts are exhausted,
and until it lands the losing handler's own sync is simply not applied.

The insert now runs inside a **SAVEPOINT**, so a collision costs only the
nested transaction — not the webhook archive and idempotency rows already
written in the same session — and the handler re-reads and falls through to
the update path on the winner's row. The second real payment, made against
the fixed code, processed all three events on first delivery with zero
failures — and did so with the arrival order *reversed*, which is the case
the original code would also have failed.

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `docs/paddle-checkout.md`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two, which is what makes naming that version honest.

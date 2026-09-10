---
title: "Subscription lifecycle"
description: "Seven distinct events rather than one upsert, and the two endpoints that move a plan."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica v0.1.2 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# Subscription lifecycle

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

## Seven handlers, not three

### The competitor pattern

Most boilerplates collapse Paddle's subscription lifecycle into a single
upsert handler:

```python
if event_type in {"subscription.created", "subscription.updated", "subscription.activated"}:
    await upsert_subscription(payload)
elif event_type == "subscription.canceled":
    await mark_canceled(payload)
elif event_type == "transaction.completed":
    await record_transaction(payload)
# subscription.past_due / .paused / .resumed → silently ignored
```

Looks DRY. Looks elegant. Three handlers for the same shape of payload.

### Where it breaks

Paddle's lifecycle has **seven** events you care about:

| Event | What it means | What you do |
|-------|---------------|-------------|
| `subscription.created` | First-time signup | Insert row, sync tier, **grant credits** |
| `subscription.updated` | Mid-cycle tier change | Sync row, sync tier, **no credit grant** (proration via transaction.completed) |
| `subscription.activated` | Trial→paid or pause→active | Sync status, no credit grant |
| `subscription.resumed` | Came back from paused | Sync status, sync period_end |
| `subscription.paused` | User paused | Mark PAUSED — but **don't downgrade tier** (user might resume) |
| `subscription.past_due` | Payment failed, retrying | Mark PAST_DUE — but **don't revoke access** (let dunning run) |
| `subscription.canceled` | End-of-life | Mark canceled_at, leave access until period_end |

The merged version gets the **first row** right and the next six wrong:

- "Grant credits" runs on `subscription.activated` as well as on
  `subscription.created`. Now the user has 2x their monthly credits.
  The two **can arrive concurrently**, and no delivery order should be
  assumed: in two executed sandbox purchases they carried the same
  `occurred_at` and arrived in *either* order
  ([paddle-checkout.md](../receipts/paddle-delivery-order)). So there is no delivery
  order to lean on when deciding which event owns the grant. It belongs to
  `created` alone, keyed on that event id.
- `subscription.paused` isn't in the dispatcher → silently dropped → your
  app keeps burning credits for a user who paused billing.
- `subscription.past_due` isn't in the dispatcher → you can't surface the
  "update your payment method" banner; user just hits credit walls until
  Paddle cancels them.
- `subscription.resumed` isn't in the dispatcher → after the user
  un-pauses, your DB still says PAUSED → credit ledger refuses to deduct
  → user posts angry support ticket.

### What we ship

Seven distinct handlers:

```python
if event_type == "subscription.created":
    await _handle_subscription_created(db, payload)
elif event_type == "subscription.updated":
    await _handle_subscription_updated(db, payload)
elif event_type == "subscription.activated":
    await _handle_subscription_activated(db, payload)
elif event_type == "subscription.resumed":
    await _handle_subscription_resumed(db, payload)
elif event_type == "subscription.paused":
    await _handle_subscription_paused(db, payload)
elif event_type == "subscription.past_due":
    await _handle_subscription_past_due(db, payload)
elif event_type in {"subscription.canceled", "subscription.cancelled"}:
    await _handle_subscription_canceled(db, payload)
elif event_type == "transaction.completed":
    await _handle_transaction_completed(db, payload)
elif event_type in {"adjustment.created", "adjustment.updated"}:
    await _handle_adjustment(db, payload)
```

Each handler does **one** thing, with one audit-log line that names the
event. When a buyer asks "did Alice's subscription get paused?", they
grep AuditLog for `action="subscription.paused"` and the answer is one
row.

The boilerplate is real (each handler reads `data`, resolves the user,
upserts the row) but factored: the row-write goes through
`_upsert_subscription_row(...)` so the surface stays small. The DRY
shows up where it matters (row writes), not at the event-routing layer
where you actively want the discrimination.

### Trade-offs

- **More lines.** 8 handlers @ ~25 LOC each ≈ 200 LOC vs. 1 collapsed
  handler at ~80 LOC. Counter: the collapsed handler hides 3 bugs that
  cost real money.
- **More tests.** One test per handler, not one for the upsert. Counter:
  the per-event tests document the per-event semantics, which is exactly
  what you want for a billing surface that has to handle every weird
  Paddle delivery order.

### Receipts

- Dispatcher: the `event_type` chain in `paddle_webhook`,
  `backend/src/api/routers/billing.py`
- Handlers: the `_handle_subscription_*`, `_handle_transaction_completed`
  and `_handle_adjustment` functions in the same file
- Per-event tests: `backend/tests/test_subscription_updated_credits.py`
  (updated / paused / canceled semantics) and
  `backend/tests/test_subscription_upsert_race.py` (created vs activated
  arriving concurrently)

## Cancel and change are different endpoints

Two endpoints, three flows. Knowing which to point your "Manage
subscription" button at depends on what the user actually wants.

Note the second name: the tier-move endpoint is `/subscription/change`,
and it moves an existing subscription **up or down** — there is no
separate downgrade route, and this file's older slug is the only place
that word survives. A third endpoint, `/subscription/resume`, brings a
paused subscription back.

### The three flows

| User intent | Endpoint | What happens |
|-------------|----------|--------------|
| "Stop my subscription, I'll come back later" | `POST /billing/subscription/cancel` | Paddle cancels at next billing period; user keeps paid tier until then; on period_end, `subscription.canceled` webhook → status flips to CANCELED. |
| "Stop my subscription RIGHT NOW (I want a refund / I made a mistake)" | `POST /billing/subscription/cancel` with `cancel_immediately=true` | Paddle cancels now; webhook → status CANCELED + downgrade. User loses access mid-period — no proration refund by default (configure in Paddle dashboard). |
| "I want to keep paying but on a different plan" | `POST /billing/subscription/change` with `target_tier` | If target = FREE → cancel at period end. Any other paid tier, higher or lower → Paddle PATCH price, prorated next billing period. Requires an active subscription: a FREE user starting one goes through `/checkout`. |

### Why two endpoints?

You could collapse them into one "manage subscription" endpoint that
takes an action discriminator. We chose not to:

- **Distinct audit-log actions.** `billing.cancel_requested` vs
  `billing.change_requested` are 2 different rows in AuditLog. When
  a buyer is debugging "why did Alice's plan change?", `grep` returns
  the exact intent.
- **Distinct frontend buttons.** "Cancel my plan" and "Switch to
  cheaper plan" have different copy + different confirmation modals.
  Each calls its own endpoint with its own request shape; no
  client-side switch over an action enum.
- **Distinct error semantics.** Cancel fails when there is no active
  subscription. Change raises a `ConflictError` when the target tier is
  the one the user is already on, and when there is no recoverable
  subscription to move. Splitting the endpoints means each returns
  errors specific to its flow.

### Cancellation timing

`cancel_immediately=false` (default) is the right default. Reasons:

1. **The user paid for the period.** Cutting them off at the moment of
   cancellation isn't necessarily what they want — they probably want
   to stop being charged *next* month.
2. **Win-back surface.** A user with 12 days left on their paid plan
   has 12 days to read your "are you sure?" email + reconsider. We
   don't auto-cancel-undo, but a `POST /cancel` followed by a
   `POST /checkout` for the same tier within the same billing period
   effectively resumes them (Paddle's `subscription.resumed` flow).
3. **Refund math is hard.** "Immediate" means "no proration refund" in
   our default Paddle config. If you DO want proration, configure it in
   Paddle dashboard → Subscriptions → Cancel settings. Then both
   immediate-cancel branches are safe.

### Downgrade math

Paddle calls it a "subscription item update" — we PATCH the
subscription's price_id and Paddle handles the proration internally:

- **Paid-tier change, either direction** → `proration_billing_mode:
  "prorated_next_billing_period"`. User keeps current-tier access
  through current_period_end; next bill is at the new tier's price.
- **Change to FREE** → there's no Paddle product for FREE, so we
  cancel at period_end instead. Same effect from the user's
  perspective: access through current period, free thereafter.

### Receipts

- Cancel endpoint: `cancel_subscription` in `backend/src/api/routers/billing.py`
- Tier-change endpoint: `change_subscription` in the same file
- Resume endpoint: `resume_subscription` in the same file
- Paddle REST helpers: `backend/src/services/paddle_api.py`

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `docs/recipes/why-split-paddle-handlers.md`, `docs/recipes/cancel-vs-downgrade.md`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two — the exporter refuses to name a product version otherwise.

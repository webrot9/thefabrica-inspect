---
title: "Background work"
description: "Worker configuration decisions, and why compensation sweeps are bounded."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# Background work

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `docs/recipes/celery-hardening.md`
> - `docs/recipes/why-reconciler-limit.md`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

## Worker hardening: the config bundle

`backend/src/workers/celery_app.py` ships a non-default Celery config.
Each setting addresses a specific failure mode. The pattern is "secure
defaults" — flipping any of these to Celery's default is a downgrade.

### Why each one

#### `task_serializer="json"` + `accept_content=["json"]`
Celery used `pickle` as the default serializer until 4.x. A malicious
broker — or any attacker who can write to Redis — can ship a payload
that the worker unpickles into arbitrary code execution. JSON
serialization makes the broker payload data-only.

Cost: you can't ship custom Python objects as task args. Hard rule
worth keeping; if a buyer needs to pass a complex object they
serialize it themselves (e.g. UUID → str at the call site).

#### `task_track_started=True`
Default is False — Celery doesn't write a "STARTED" state to the
result backend. With this on, monitoring tools (Flower, Sentry's
Celery integration) can show "task is alive, working" vs "task is
queued" — the difference between a worker being stuck and a worker
being idle.

#### `worker_prefetch_multiplier=1`
Default is 4. Celery prefetches N×concurrency tasks from the broker
per worker so the worker has work queued up locally. Default is fine
for short tasks; ruins long tasks because:
1. Prefetched tasks aren't visible to other workers.
2. If worker A grabs 4 tasks and one takes 30 minutes, the other 3
   sit waiting — even if worker B is idle.

The factory's tasks (reconciler, expiry, deletion) are short, but
buyer-added tasks might not be. `=1` is the safe default; buyers
who add lots of small tasks can raise it.

#### `worker_max_tasks_per_child=10`
Recycle the worker process every 10 tasks. Defeats memory leaks in
async loops + third-party libraries (looking at you, every SDK that
caches DNS lookups forever). 10 is the safe default; buyers can raise
it if task startup cost is high.

#### `worker_cancel_long_running_tasks_on_connection_loss=True`
If the broker connection dies mid-task, the broker won't see the ACK
when the task completes — so on broker reconnect, the task gets
redelivered. With this setting, the worker gives up on the orphaned
task instead of completing it (and having it re-delivered → double
work). Pair with `task_acks_late=True` for at-least-once semantics
that won't double-bill the user.

#### `worker_hijack_root_logger=False`
Celery's default replaces the root logger config — which means your
careful FastAPI logging setup gets clobbered the moment a worker boots.
Off means our `src/config/logging.py` keeps owning the
logger hierarchy.

#### `task_acks_late=True` + `task_reject_on_worker_lost=True`
Default is "ack the task on receipt" — if the worker crashes mid-task,
the broker considers it done. With `acks_late`, the worker only ACKs
after `task_completed`. If the worker dies, the broker redelivers.
Pair with the orphan-deduct reconciler (`why-credit-ledger.md`) and
you have at-least-once semantics that don't burn user credits when
the worker dies.

### Operational notes

- **Flower / Celery beat**: same config applies — both processes
  inherit `app.conf`. No special setup.
- **CI tests**: tests don't talk to the broker directly; tasks are
  invoked via `_task_func.delay(...)` or directly via the async
  helpers exposed by each task module (so we never need a live
  Celery worker in CI).
- **Replacing the broker**: if a buyer swaps Redis for RabbitMQ, the
  `task_serializer / accept_content / acks_late` settings are
  broker-agnostic and survive. The TLS hardening in `get_broker_url`
  is Redis-specific; for RabbitMQ replace with the equivalent AMQP
  TLS config.

### Receipts

- `backend/src/workers/celery_app.py`

## Bounded reconciler sweeps

`reconcile_orphan_credits` (Celery beat task, every 60 seconds) caps
its per-pass work at `DEFAULT_RECONCILE_LIMIT = 200` orphan candidates.
Two reasons.

### Why bound at all

A pristine system has zero orphans. The reconciler scans the DB,
finds nothing, returns. Fast.

A failing system — broker outage, Celery worker crash loop, ill-timed
deploy — can leave **hundreds** of orphan deducts in one beat
interval. Without a limit:

1. The reconciler's `list_orphan_deducts_older_than(...)` query
   returns thousands of rows.
2. The Python loop iterates each, issuing a refund per orphan.
3. Each refund is a SQL INSERT — fast individually, but the loop
   holds the session open the whole time.
4. The beat scheduler doesn't fire the next reconciler tick because
   the previous one is still running.
5. Real-time correctness: a user whose orphan deduct landed AFTER the
   sweep began waits until the next sweep — which is delayed.

With `limit=200`:
- Worst-case 200 refunds × ~5ms each = ~1 second per pass.
- Next pass fires on schedule, picks up the next 200.
- A backlog of 10k orphans clears in ~50 passes / ~50 minutes.

Trade-off: backlogged orphans take longer to refund. Mitigation: the
lazy-reconcile path on `GET /billing/credits` (planned — flag in
audit) reconciles a single user on-demand, so user-visible lag is
bounded by HTTP request time, not the beat cadence.

### Why structured result

Old API:
```python
@shared_task
def reconcile_orphan_credits() -> int:
    return await _reconcile_async()  # returned the refund count
```

New API:
```python
@dataclass(frozen=True, slots=True)
class ReconcileResult:
    scanned: int = 0
    refunded: int = 0
    skipped_lifecycle: int = 0

async def _reconcile_async(...) -> ReconcileResult: ...
```

The Celery task entrypoint still returns the int (for compatibility
with monitoring tools that surface task return values), but the async
helper returns the rich shape. Why it matters:

- **Tests**: `assert result.scanned == 5 and result.refunded == 3` is
  more informative than `assert result == 3`. When the test fails, you
  see which orphans got skipped.
- **Observability**: the beat task logs
  `extra={"scanned": ..., "refunded": ..., "skipped_lifecycle": ...}`
  so you can grep "scans found 200 candidates but refunded 0" — a
  signal that something's writing `task_started` after the orphan
  threshold (i.e. workers are running very slowly).
- **Buyer extension**: a buyer who wires the reconciler into a
  Sentry / DataDog metric wants the `scanned / refunded` split, not
  just the total.

### Reading the skip count

`skipped_lifecycle` means: "we found N deducts that LOOKED orphan in
the initial scan, but by the time we checked again a `task_started`
or `task_completed` row had landed". This is the race condition the
reconciler is built around — workers writing `task_started` slightly
after the deduct's age crosses the orphan threshold. Healthy values:

- `skipped_lifecycle = 0` — normal. Worker latency is well under the
  5-min threshold.
- `skipped_lifecycle > 0, refunded > 0` — borderline. Workers
  occasionally slow. Investigate p99 task pickup latency.
- `skipped_lifecycle >> refunded` — workers consistently slow. Either
  raise the orphan threshold (`ORPHAN_THRESHOLD_S` in `credit_ledger.py`)
  or scale the worker pool. Otherwise the reconciler is mostly
  doing pointless work.

### Receipts

- `backend/src/workers/credit_reconciler.py`
- Repository method: `backend/src/services/repositories_async/credit_transaction.py:list_orphan_deducts_older_than`

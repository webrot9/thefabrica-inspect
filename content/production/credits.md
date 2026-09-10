---
title: "Credits are a ledger, not a counter"
description: "Why metering is append-only, and the two mechanisms that keep it safe."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Extracted from The Fabrica v0.1.2.
     Edits belong in the product documentation, not here. -->

# Credits are a ledger, not a counter

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

## The competitor pattern

Other AI SaaS boilerplates ship something like this:

```python
class User(Base):
    has_access: bool = False
    credits_remaining: int = 0
```

```python
# In the LLM endpoint:
if not user.has_access and user.credits_remaining < 1:
    raise HTTPException(402, "Out of credits")
user.credits_remaining -= 1
session.commit()
```

That works until the first time something interesting happens. Concretely:

| Failure mode | What goes wrong |
|---|---|
| Two concurrent requests | Both read `credits_remaining=1`, both decrement to 0, both succeed. User burned 2 generations for 1 credit. |
| Worker crash mid-task | Credit deducted, no work done, no refund — the user paid, you didn't deliver. They dispute. You eat the chargeback. |
| Celery retry on transient failure | Task body runs twice, credit deducted once because the API handler already committed. User paid 1×, got 2 generations. |
| Refund dispute | "I never used the 87 credits you charged me for last month." You have one column, no audit trail. Paddle sides with the user. You eat 87 credits. |

## What we ship instead

`credit_transactions` is an append-only ledger. Every credit movement is one
INSERT — never an UPDATE.

```sql
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta INT NOT NULL, -- -1 for deduct, +1 for refund, 0 for lifecycle
    kind VARCHAR(32) NOT NULL, -- deduct | refund | grant | task_started | task_completed | task_failed
    job_id VARCHAR(128) NOT NULL, -- Celery job id (or minted UUID for one-shots)
    reason VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (job_id, kind)
);
```

Balance is `SELECT SUM(delta) FROM credit_transactions WHERE user_id = $1`.

### Two mechanisms, two different jobs

Conflating these is the mistake worth avoiding, because each one leaves
exactly the gap the other closes. There are **no Postgres advisory locks**
anywhere in the ledger, and no SAVEPOINT.

**`UNIQUE (job_id, kind)` makes one logical operation idempotent.** A given
job produces at most one row of each kind, so a broker redelivery of the
*same* attempt cannot insert a second `deduct`. It does nothing for two
*different* jobs racing: each would read the same pre-deduct balance and
both could pass the check.

**A `FOR UPDATE` row lock on the owning user makes the balance check
atomic.** `deduct_credits` takes it before reading the balance and holds it
to the end of the transaction, so check-then-insert cannot interleave.
Concurrent spends on one account serialise; spends on different accounts
do not contend. Without it, two deducts with different `job_id`s each take
their READ COMMITTED snapshot before either commits, both see enough
balance, and the account goes negative.

The idempotency key has a sharp edge, and it is a design consequence rather
than a bug: reusing a `job_id` for a genuinely new chargeable attempt
returns the original movement and charges nothing. Mint a fresh `job_id`
per chargeable attempt; keep it stable only across transparent
redeliveries of the same attempt.

### What each failure mode actually hits

- **Two requests, same `job_id`** → the second INSERT trips `IntegrityError`; the caller rolls back, re-reads and returns the row that won. No double-spend.
- **Two requests, different `job_id`s** → the row lock serialises them. The second reads the balance the first committed and raises `InsufficientCreditsError` if it no longer covers the spend.
- **Worker crash after deduct** → the ledger has a `deduct` row with no matching `task_started`. The reconciler runs every 60 seconds and refunds any deduct that has stayed orphaned for `ORPHAN_THRESHOLD_S` (5 minutes), inserting a `reconciler_refund` row.
- **Celery retry** → `record_task_started(job_id)` is idempotent via the same UNIQUE constraint. Retry-safe.
- **Refund dispute** → every movement has a timestamp, a reason and a linked `job_id`. Answering is a query, not an investigation.

## Trade-offs (we are honest)

This is more code than the `has_access` pattern. Specifically:

- `workers/credit_ledger.py` is a module with a spend path, a compensation path and the lifecycle markers, against ~20 lines for the simple approach.
- Reconciler is a separate Celery beat task running every 60 seconds.
- Balance read is `SUM()` over a table that grows ~3 rows per generation. Add an index, accept the cost.

One alternative approach uses the same append-only ledger with a `users.credits_remaining` integer column kept in sync via conditional UPDATE. That's a third valid design — slightly simpler at the cost of a denormalised column that can drift. We chose pure event-sourcing because (a) it can't drift, and (b) it composes cleanly with the AuditLog pattern we already ship for GDPR Art. 30.

## Receipts

- Source: `backend/src/workers/credit_ledger.py`
- Row lock: `CreditTransactionRepository.lock_user_row` in `backend/src/services/repositories_async/credit_transaction.py`
- Idempotency key: `uq_credit_transactions_job_kind` in `backend/src/models/credit_transaction.py`
- Reconciler: `backend/src/workers/credit_reconciler.py`
- Race-condition test: `test_concurrent_deducts_do_not_double_spend` in `backend/tests/test_credit_ledger.py` — two spends, **different** `job_id`s, so the unique constraint cannot help and only the row lock can

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `docs/recipes/why-credit-ledger.md`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two, which is what makes naming that version honest.

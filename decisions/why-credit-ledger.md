# Why credits are a ledger, not a counter

Metered AI products need to answer "how many credits does this user
have left?". The cheap answer is a mutable integer on the user row:

```python
class User(Base):
    credits_remaining: int = 0
```

```python
if user.credits_remaining < 1:
    raise HTTPException(402, "Out of credits")
user.credits_remaining -= 1
await session.commit()
```

This is correct exactly until something concurrent, something retried,
or something disputed happens — which is to say, until production.

## What breaks

**Concurrency.** Two requests read `credits_remaining = 1` in
overlapping transactions. Both see enough balance. Both write `0`. The
user got two generations for one credit. Under READ COMMITTED, both
snapshots are taken before either commits, so neither transaction sees
the other's decrement.

**Partial failure.** The credit is deducted, then the worker crashes
before producing anything. The user paid and received nothing. Nothing
in the schema knows a refund is owed.

**Retries.** A task broker redelivers a message. If the deduct happened
in the API handler and the work happens in the task, the work runs
twice on one charge. If the deduct happens in the task, it runs twice
and charges twice. Either way the counter is wrong, and which way it is
wrong depends on where the retry landed.

**Disputes.** A customer says they never spent the credits you billed
for. A single integer column cannot answer that. There is no record of
what was spent, when, or on what.

None of these are exotic. They are the normal operating conditions of a
metered product, and a counter has no representation for any of them.

## The shape we ship instead

Credit movements are append-only. Every change is one INSERT; the
balance is a function of the rows, not a field anyone overwrites.

```sql
CREATE TABLE credit_transactions (
    id         UUID PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta      INT  NOT NULL,          -- negative to spend, positive to grant
    kind       VARCHAR(32)  NOT NULL,  -- deduct | refund | grant | lifecycle markers
    job_id     VARCHAR(128) NOT NULL,  -- the unit of work this movement belongs to
    reason     VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (job_id, kind)
);
```

Balance is `SELECT SUM(delta) FROM credit_transactions WHERE user_id = ?`.

Two distinct mechanisms do two distinct jobs, and conflating them is
the mistake worth avoiding:

**`UNIQUE (job_id, kind)` makes each movement idempotent.** A redelivered
retry carrying the same `job_id` cannot insert a second `deduct` row —
the constraint rejects it and the caller returns the movement that
already exists. This is what makes the spend path safe to retry.

The idempotency key has a sharp edge, and it is a design consequence
rather than a bug: reusing a `job_id` for a genuinely new chargeable
attempt returns the original movement and charges nothing. A fresh
`job_id` must be minted per chargeable attempt, and kept stable only
across transparent redeliveries of the *same* attempt.

**A row lock makes the balance check atomic.** The unique constraint does
nothing for two *different* jobs racing: each would read the same
pre-spend balance and both could pass the check. The spend path
therefore takes a lock on the user's row before reading the balance and
inserting, so check-then-insert cannot interleave. Concurrent spends on
one account serialise; spends on different accounts do not contend.

**Compensation is a row, not a mutation.** When work fails, the refund is
a new positive movement, not an edit to the deduct. A sweep looks for
spends with no matching completion marker and issues a compensating
movement. Because the ledger is append-only, a refund that runs twice
is caught by the same uniqueness rule that protects the spend.

**The audit trail is a side effect of the design.** Every movement carries
its timestamp, reason, and originating job. Answering a dispute is a
query, not an investigation.

## What this costs

More code than a counter, and more than an example needs — a spend path,
a compensation path, and a periodic sweep, versus one decrement.

Balance is a `SUM()` over rows that accumulate for the life of the
account. It is indexed, and at the row counts a per-seat AI product
generates this is not the bottleneck. At much larger volumes it would
need a periodic rollup, and that work has not been done here.

A middle design exists: keep the append-only ledger and also maintain a
denormalised balance column via conditional UPDATE. It reads faster and
is genuinely defensible. We did not choose it because a derived column
can drift from the rows it summarises, and a balance that disagrees
with its own ledger is a worse failure than a slower read.

## How to falsify this

The claim is that concurrent spends cannot overdraw an account. It is
tested, not asserted: see
[`receipts/credit-ledger-concurrency-test.md`](../receipts/credit-ledger-concurrency-test.md)
for the invariant, the setup, and the current result.

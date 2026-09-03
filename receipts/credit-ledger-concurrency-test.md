# Receipt: concurrent spends cannot overdraw an account

[`decisions/why-credit-ledger.md`](../decisions/why-credit-ledger.md)
claims that two requests racing on the same account cannot spend more
credits than the account holds. This page is the evidence for that
claim.

It is a description of a test that exists in the private repository, not
a copy of it. The point is that you can check the claim is tested at
all, and check what it would take to break it.

**Private test:** `test_concurrent_deducts_do_not_double_spend`, in the
credit-ledger test module.

## The invariant

> Two concurrent spends against one account, in separate transactions
> on separate connections, must not both succeed when the balance can
> only cover one of them.

Note what this is *not* testing. Retry-safety — the same unit of work
being delivered twice — is a different property, guarded by the
`UNIQUE (job_id, kind)` constraint and covered by its own tests. This
test deliberately uses two **different** job ids, so the uniqueness
constraint cannot help. It exercises the case the constraint does not
cover: two genuinely distinct spends interleaving their balance checks.

## Setup

| | |
|---|---|
| Starting balance | 10 credits |
| Concurrent operations | 2 spends of 7 credits each |
| Job ids | Distinct — one per spend |
| Isolation | Each spend runs in its own session, on its own connection, in its own transaction |
| Concurrency | The two spends are awaited together, not in sequence |

The separate-connection detail is load-bearing. Two spends sharing a
session would serialise on the session itself and the test would pass
without proving anything. Real concurrency needs real connections, so
this test commits for real rather than running inside the suite's usual
per-test rollback — and cleans up after itself so the committed rows do
not leak into other tests.

## Expected outcome

```text
successes == 1              # exactly one spend is allowed
final balance == 3          # 10 - 7, the rejected spend charged nothing
```

The losing call raises an insufficient-credits error. It does not
partially apply, and it does not leave a movement behind.

## What regression this catches

Remove the row lock taken before the balance check and the test fails
immediately, in the way that matters:

- Both transactions read a balance of 10 under READ COMMITTED, because
  each takes its snapshot before the other commits.
- Both find 10 ≥ 7 and insert a spend of 7.
- The account settles at **−4**. Both callers were served; one was
  never paid for.

The assertion that fails is `successes == 1`, with both spends
reporting success. That is a double-spend, and it is silent in
production: nothing errors, the balance is simply wrong, and it is
discovered later from a support ticket rather than from a log.

This is the test that makes "we use a ledger" a checkable statement
rather than a design preference.

## Where it runs

The backend CI job, on every push and every pull request. It is an
integration test: it runs against a real PostgreSQL service container,
not a mock or an in-memory substitute — a fake would not reproduce the
isolation-level behaviour the test exists to pin down. The same job
runs `ruff`, `mypy --strict`, a full Alembic upgrade/downgrade/upgrade
round-trip, and a coverage floor.

## Current result

**Passing** on the current `main` (commit `4815b5e`, CI run of
2026-09-03).

You are reading a vendor's report of their own test result, which is
worth exactly what you think it is worth. The test and its CI history
are readable in full on the first day of a licence — that is the point
at which this receipt becomes verifiable rather than merely stated.

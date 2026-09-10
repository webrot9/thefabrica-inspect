---
title: "Account lifecycle and erasure"
description: "Soft delete with a grace window, and erasure as a real code path."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica v0.1.2 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# Account lifecycle and erasure

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

`DELETE /api/v1/account/me` doesn't actually delete the row. It sets
`User.deleted_at = now()` and a daily Celery beat task runs the
hard-delete after a 30-day grace period.

## What competitors ship

```python
@router.delete("/me")
async def delete_account(user, db):
    await db.delete(user)  # cascades, scorched earth
    await db.commit()
    return {"message": "Account deleted."}
```

GDPR Art. 17 says "right to erasure", so the row goes. Job done.

## Where that breaks

1. **The "oops" account**: user clicks delete from the wrong account
   (signed into two browsers), or clicks delete then changes their
   mind 20 minutes later. No undo. The data is gone. Cascades take
   subscriptions, audit history, credit ledger with them.
2. **The chargeback dispute**: user deletes their account, then
   disputes their last subscription payment 30 days later. You have
   no record of the user, can't show Paddle the audit trail, lose
   the dispute. Paddle keeps records itself (Merchant of Record), but
   your *own* audit log is gone.
3. **The compromised account**: attacker gets temporary access to a
   user's session, deletes their account out of malice. User has zero
   recourse. With soft-delete + grace, the user signs back in, sees a
   "your account is scheduled for deletion on ..." banner, and clicks
   cancel.

## What we ship

```python
@router.delete("/me", response_model=AccountDeleteResponse)
async def delete_my_account(user, db, request):
    now = datetime.now(UTC)
    user.deleted_at = now
    await log_action_async(db, ...)
    return AccountDeleteResponse(
        deleted_at=now,
        hard_delete_after=now + timedelta(days=GRACE_PERIOD_DAYS),
    )
```

The matching Celery beat task is `workers/account_deletion.py` — it
runs daily, finds rows where `deleted_at < now() - GRACE_PERIOD_DAYS`,
and `DELETE`s them. ON DELETE CASCADE in the subscription / audit /
credit-transaction FKs handles the rest.

Until the worker runs, the user can:
1. Sign back in via Clerk.
2. Hit the (admin / buyer-extension) "cancel deletion" endpoint —
   nulls `deleted_at`, the row stays.

GDPR-wise this is still compliant: Art. 17 allows a "without undue
delay" window, and 30 days is well within that. We document the
window in the privacy policy + the deletion-scheduled email.

## Buyer override

Some buyers DO want hard-delete on the API path (regulated industries
where "soft delete" doesn't satisfy auditors). Override:

```python
# src/workers/account_deletion.py
GRACE_PERIOD_DAYS = 0
```

The daily worker now hard-deletes anything with `deleted_at` set on
the next run. The API still soft-deletes first — the only way to
get truly-synchronous hard delete is to await the worker from the
endpoint, which is a bad pattern (DELETE blocks for as long as
cascades take, which on a fat account can be seconds).

## Receipts

- Endpoint: `backend/src/api/routers/account.py:delete_my_account`
- Worker: `backend/src/workers/account_deletion.py`

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `docs/recipes/soft-delete-vs-hard-delete.md`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two — the exporter refuses to name a product version otherwise.

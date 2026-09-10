---
title: "Signing the checkout payload"
description: "The identity-confusion attack, and the HMAC binding that closes it."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# Signing the checkout payload

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `docs/recipes/why-checkout-signing.md`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

## The competitor pattern

Other AI SaaS boilerplates open Paddle's checkout overlay like this:

```ts
// client side
const { paddle_price_id } = await api.post("/checkout", { tier })
Paddle.Checkout.open({
  items: [{ priceId: paddle_price_id }],
  customer: { email: user.email },
  customData: { clerk_user_id: user.id, tier },
})
```

```python
# server side, webhook handler
async def handle_paddle_webhook(payload):
    user_id = payload["data"]["custom_data"]["clerk_user_id"]
    user = await users.get(user_id)
    # ... bind subscription to user
```

The webhook handler trusts whatever `custom_data` arrives. The frontend
puts it in, Paddle delivers it back, the server reads it. Three hops, one
of which (the frontend) is fully attacker-controlled.

## The attack

Alice initiates checkout. Before clicking "Pay", she opens DevTools and
swaps `customData.clerk_user_id` from her own ID to Bob's. She completes
payment.

Paddle's webhook fires with `custom_data.clerk_user_id = bob`. The
handler dutifully binds the subscription to Bob's account. Bob now has
a tier he didn't pay for. Alice waits 60 days, then disputes the
Paddle charge ("I didn't authorise this"). Paddle refunds Alice. You
get the chargeback fee. Bob keeps the tier until you notice — could
be months.

Variant: Alice swaps the `price_id` for a cheaper tier. Mostly
self-defeating (she gets what she paid for), but creates support
confusion when the subscription state on your side doesn't match
Paddle's billing.

## What we ship instead

When `/checkout` resolves a price_id, we HMAC-sign a payload binding
`(user_id, email, price_id, issued_at)` and return the signature:

```python
# services/paddle.py
def sign_checkout_payload(*, user_id, email, price_id) -> str | None:
    secret = settings.paddle_webhook_secret.get_secret_value().encode()
    issued_at = int(datetime.now(UTC).timestamp())
    msg = f"v1|{user_id}|{email.lower()}|{price_id}|{issued_at}".encode()
    digest = hmac.new(secret, msg, hashlib.sha256).hexdigest()
    return f"{issued_at}:{digest}"
```

Frontend includes it in `custom_data.thefabrica_sig`:

```ts
Paddle.Checkout.open({
  items: [{ priceId: checkout.paddle_price_id }],
  customer: { email: user.email },
  customData: {
    clerk_user_id: user.id,
    tier,
    thefabrica_sig: checkout.checkout_signature,  // ⬅ binding
  },
})
```

The webhook handler verifies before acting:

```python
# routers/billing.py
sig = custom_data.get("thefabrica_sig")
if not verify_checkout_payload(
    user_id=str(candidate.id),
    email=candidate.email,
    price_id=price_id,
    signature=sig,
):
    raise ConflictError("Paddle webhook custom_data signature verification failed.")
```

Properties:

- **Tampering fails closed.** Alice can swap `clerk_user_id` but she can't
  re-sign for Bob's `(user_id, email)` — she doesn't have the
  `paddle_webhook_secret`.
- **6-hour MAX_AGE.** Old signatures (replay attacks, captured checkout
  intents) fail. Covers slow checkout flows + Paddle's webhook retry
  window.
- **5-min future skew tolerance.** Clock drift between API servers
  doesn't false-reject.
- **Email lowercased before hashing.** `Alice@example.com` signs the
  same as `alice@example.com`.
- **Constant-time compare** via `hmac.compare_digest`. Timing-attack
  resistant.

## The 3-strategy fallback

`custom_data` isn't always present (legacy purchases, Paddle dashboard
manual adjustments, third-party integrations). We have a fallback chain:

1. **Signed `custom_data.clerk_user_id`** — verified, gold-standard.
2. **`paddle_customer_id`** → existing Subscription → User. Works for
   renewals + lifecycle events where the original purchaser is known.
3. **`customer.email`** case-insensitive match. Last resort; logged as
   a fallback so you can monitor verification gaps.

If `(1)` was attempted (signature present) but failed, we hard-reject
— that's an attack signal, not a missing-data case.

## Trade-offs

- One more secret to rotate (we reuse `paddle_webhook_secret` to avoid
  introducing a new one).
- Frontend must pass the signature through. If a buyer skips it, the
  webhook handler degrades to fallback strategies 2 + 3.
- Signing fails gracefully when `paddle_webhook_secret` is unset (dev
  mode): `checkout_signature` is null, webhook handler uses fallbacks.

## Receipts

- `sign_checkout_payload` / `verify_checkout_payload`: `backend/src/services/paddle.py`
- Webhook handler: `_find_user_from_webhook_data` in `backend/src/api/routers/billing.py`
- Tests: 8 cases in `backend/tests/test_paddle_service.py` (`test_sign_then_verify_roundtrip`, `test_verify_rejects_tampered_*`, `test_verify_rejects_signature_older_than_6h`, etc.)

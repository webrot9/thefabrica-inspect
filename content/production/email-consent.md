---
title: "Consent and one-click unsubscribe"
description: "The only public side-effecting endpoint, and why an HMAC token is its auth."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# Consent and one-click unsubscribe

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `docs/recipes/why-unsubscribe-is-public.md`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

`GET/POST /api/v1/email/unsubscribe?t=<token>` is the only public,
unauthenticated, side-effect-having endpoint in the factory. That's
not an oversight.

## What gates it

The endpoint takes one query param: `t` — an HMAC-SHA256 token bound
to `(clerk_user_id, issued_at)` signed with
`EMAIL_UNSUBSCRIBE_SECRET`. The handler:

1. Verifies the HMAC. Bad/missing/forged → 401.
2. Looks up the user by `clerk_user_id`.
3. Sets `User.marketing_consent_given = False`.
4. Redirects to `(marketing)/unsubscribed`.

No Clerk session required. No CSRF token. No login.

## The constraint: RFC 8058 + mailbox reality

RFC 8058 ("Signaling One-Click Functionality for List Email Headers")
mandates that the `List-Unsubscribe` URL in marketing email headers
must work via a single HTTP request — no interactive auth, no
multi-step flow. Gmail's "Unsubscribe" button uses this. Apple Mail
uses this. Outlook uses this.

If the endpoint were auth-gated, three failure modes:

1. **The mailbox-on-another-device problem.** User clicks
   "Unsubscribe" from their work Gmail. They've never logged in to your
   app on that machine. Auth-gated endpoint → "please log in to
   unsubscribe" → user gives up + clicks "Mark as spam" instead. Your
   sender reputation craters.
2. **The lost-session problem.** User receives the email 6 months
   after signup. Clicks unsubscribe. Their Clerk session expired.
   Auth-gated → login prompt → they don't remember the password.
   Spam button gets clicked. Reputation, again.
3. **RFC 8058 compliance.** Gmail won't show the inline Unsubscribe
   button in the message header unless the
   `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header is
   present AND the endpoint accepts unauthenticated POST. If you
   gate auth, Gmail demotes your delivery score.

## The HMAC token IS the auth

Cryptographically: the token is unforgeable without the secret +
binds to a single user + has a TTL (no MAX_AGE in our default — Gmail
caches links, so we tolerate replay; the worst case is "unsubscribe
gets re-applied" which is idempotent). An attacker who:

- Doesn't have the secret: can't mint a valid token.
- Has the secret: has bigger problems than unsubscribing your users.
- Has someone else's token (stolen email, phishing): can unsubscribe
  *that user*, which is annoying but not catastrophic — the user just
  re-opts-in via `POST /me/consent`.

So the threat model is: "someone can unsubscribe a user from
marketing email" — recoverable, audit-logged, low-blast-radius. Worth
trading for the deliverability + RFC compliance benefits.

## The audit-log side

The handler writes `action="email.unsubscribed"` with
`details={"via": "one_click_link"}` + the requester IP. If you ever
need to investigate "did Alice really unsubscribe or was it
malicious?", the IP + timestamp are there.

## What it doesn't gate against

- **CSRF**: the endpoint accepts both GET and POST. There is no
  cross-site form that can mint a valid token + submit it, so CSRF
  via origin-spoofing isn't viable. (The query-param HMAC is the
  CSRF defense.)
- **Replay**: an old token still works. By design — Gmail caches
  the URL in the message header for weeks. We accept the
  "unsubscribe is idempotent" trade-off to support that.

## Receipts

- Endpoint: `backend/src/api/routers/email.py:unsubscribe`
- Token primitive: `backend/src/services/unsubscribe.py`
- Header injection: `backend/src/services/email.py:send_marketing`

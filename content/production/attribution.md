---
title: "First-touch attribution"
description: "Why attribution is first-touch, and why the frontend carries it."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# First-touch attribution

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `docs/recipes/first-touch-utm.md`
> - `docs/recipes/why-utm-via-frontend.md`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

## First-touch, not last-touch

When Alice clicks a Twitter ad, lands on `/?utm_source=twitter&utm_medium=cpc`,
bounces, then comes back 2 days later via direct traffic and signs up,
our attribution says **Twitter**. Not "direct". Not "two sources, weighted".
Twitter, period.

### The competitor pattern

Last-touch attribution: whatever the user came in from on the
signup session wins. Simple — read URL params during sign-up, ship
to backend, done.

```ts
// On the signup page itself
const params = new URLSearchParams(window.location.search)
await api.post("/me/signup-metadata", {
  utm_source: params.get("utm_source"),
  utm_medium: params.get("utm_medium"),
})
```

### Where last-touch breaks

The classic SaaS funnel:
1. User clicks Twitter ad with `utm_*` params → lands on `/blog/article-1`.
2. Reads, doesn't sign up. Closes tab.
3. Tomorrow remembers, types `thefabrica.dev` directly.
4. Signs up.

Last-touch attribution: source = direct. Twitter ad gets zero credit.
Your marketing dashboard shows organic / direct converting at twice
the rate of paid → you cut the Twitter budget → conversions drop →
you wonder why.

### What we ship

```ts
// lib/utm.ts
const STORAGE_KEY = `${PROJECT_SLUG}:utm:v1`
const TTL_MS = 30 * 24 * 60 * 60 * 1000

export function storeIfEmpty(capture: UtmCapture): void {
  if (localStorage.getItem(STORAGE_KEY)) return  // ⬅ first-touch lock
  localStorage.setItem(STORAGE_KEY, JSON.stringify(capture))
}
```

- **localStorage, not sessionStorage.** Survives tab close + browser
  restart. Last-touch via sessionStorage loses the Twitter visit when
  the user closes the tab.
- **30-day TTL.** Long enough to capture the typical "read content,
  come back later, sign up" buyer journey. Short enough that a user
  who clears their cookies + reinstalls is treated as fresh on the
  next campaign.
- **storeIfEmpty, not store.** First-touch hard lock. A returning
  visitor's Reddit referrer doesn't overwrite the original Twitter
  attribution.

Pair with the backend's idempotent-once write semantics
(`/me/signup-metadata` returns `recorded: false` if attribution
already set) → end-to-end: even if the frontend flushes the same
capture twice, the backend ignores the second write.

### Why not multi-touch?

Multi-touch (track every campaign, weight by recency / position) is
correct in theory and a nightmare in practice:
- Schema bloat: one row per touch per user, not one row per user.
- Reporting ambiguity: "Twitter contributed 40% to Alice's
  conversion" doesn't translate to "spend more on Twitter".
- Compliance overhead: each tracked touch is a PII row, all subject
  to GDPR delete-and-export requirements.

First-touch is wrong sometimes (a user who actually converted because
of the third email gets attributed to the first ad). It's wrong in a
**known direction** — biased toward TOP-of-funnel campaigns. That's
the trade-off we ship: predictable, simple, easy to reason about
when reallocating budget.

### 30-day TTL trade-off

A buyer running long-cycle B2B sales might want 90 days. Override:

```ts
// lib/utm.ts
const TTL_MS = 90 * 24 * 60 * 60 * 1000
```

A buyer running short-cycle consumer might want 7 days (you trust
that anyone who waits longer is converting on something else). Same
file, same line.

### Receipts

- Capture: `frontend/src/lib/utm.ts`
- Hook: `frontend/src/hooks/use-utm-capture.ts`
- Provider: `frontend/src/components/providers/utm-provider.tsx`
- Backend endpoint: `backend/src/api/routers/account.py:record_signup_metadata`

## Why capture goes through the frontend

The factory's `POST /api/v1/account/me/signup-metadata` accepts UTM
fields from a frontend client. Couldn't we just have the backend
extract them from the request's `Referer` header on the Clerk
`user.created` webhook? No. Three reasons.

### 1. Clerk's webhook isn't the user's request

```
Browser → Clerk → Clerk's webhook → our backend
```

The `Referer` header on the webhook request is **`https://clerk.com/...`**
(Clerk's server origin), not whatever URL the user landed on. The
actual landing-page URL never reaches our backend in that flow —
Clerk doesn't forward it.

To capture UTM server-side we'd have to:
1. Read params from Clerk's signup URL via Clerk's custom-data field.
2. Configure Clerk to pass them through (different API per Clerk
   plan tier).
3. Trust whatever the frontend wrote into the custom-data field
   (which is just localStorage → form-field → Clerk → us — same
   trust chain, more hops).

Frontend POST direct to backend is shorter and equally trustworthy.

### 2. The signup might be days after the landing

```
Day 0: Alice visits via Twitter ad → reads blog
Day 0: Alice closes tab
Day 5: Alice opens a new tab, types thefabrica.dev directly
Day 5: Alice signs up
```

There is no request-time signal on Day 5 that the user came from
Twitter on Day 0. localStorage IS the signal — and localStorage lives
in the browser. The backend can't read it server-side; the frontend
has to ferry it.

### 3. The flow doesn't gate on auth

```
Day 0: Anonymous user visits → captureFromCurrentPage() → storeIfEmpty()
Day 5: Same user signs up → useAuth().isSignedIn flips true → flush
```

The first effect (capture) runs on **any** page visit, including
fully anonymous ones. We don't have a backend request to attach the
capture to until the user actually signs up. The frontend holds the
state in the meantime.

A backend-only design would require either:
- An anonymous "pre-signup attribution" endpoint that mints a
  visitor_id cookie → tracks all attributions per visitor_id →
  later links visitor_id to user_id on signup. Three tables, GDPR
  surface, cookie-banner consent angle. Way more.
- Skipping pre-signup capture entirely → losing the buyer journey
  pattern that first-touch is designed for.

### What this means for buyers

The Pythonic side of the boilerplate doesn't have to ship a tracking
service. The frontend hook does the work. Backend stays minimal: one
endpoint, one DB write, one idempotency rule. Buyer instinct to "do
it server-side because frontend can be bypassed" doesn't apply here —
the worst a bypass does is fail to capture attribution (Alice's
attribution stays NULL), which is the same as the natural failure
mode (Alice disables JS).

The one trade-off: if a buyer specifically wants server-side
last-touch fallback ("if frontend didn't ship a capture in N days,
extract Referer from the first authenticated request"), they wire it
in `deps.py` on top of the lazy-create path. That is buyer territory —
the factory ships no hook for it.

### Receipts

- Frontend ferry: `frontend/src/hooks/use-utm-capture.ts`
- Backend receiver: `backend/src/api/routers/account.py:record_signup_metadata`

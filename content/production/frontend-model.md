---
title: "Server components by default"
description: "Where the client boundary falls, and what that costs."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Extracted from The Fabrica v0.1.2.
     Edits belong in the product documentation, not here. -->

# Server components by default

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

The factory's frontend defaults to React Server Components (RSC).
`"use client"` is opt-in, file-by-file, only where it's load-bearing
(interactive forms, auth state, useEffect-driven flows). Client
components are the minority of what ships under `app/`, and the
boundary falls in one place: the authenticated dashboard.

## The competitor pattern

```tsx
// competitor/app/page.tsx
"use client"

import { useState } from "react"
// ... whole page is client side, including static marketing copy.
```

Most boilerplates default everything to client because:
- It "just works" — no thinking about server/client boundaries.
- `useState` / `useEffect` work everywhere.
- Tutorials assume client.

Result: every page ships the React runtime + all its dependencies to
the browser. A 200-line page becomes a 250-KB JS bundle. The
marketing landing — which doesn't have a single button — loads as
if it were an SPA.

## Where it breaks

1. **First Contentful Paint regression**. RSC renders to HTML on the
   server; the user sees content immediately. Client-component pages
   blank-screen until the JS downloads + parses + hydrates.
2. **SEO + sharing**. RSC's server-rendered HTML is what Googlebot
   crawls + what shows up in Twitter/Slack link unfurls. Client-only
   pages need extra `next/head` work + still don't unfurl reliably.
3. **Bundle size**. Each `"use client"` boundary is a code-split
   chunk. A blog page with 5 client components = 5 bundles to load.
   Server components don't ship JS.
4. **State management complexity**. Half the React ecosystem
   (Recoil, Zustand, server-state-via-client-fetch) exists to work
   around the limits of client-only. RSC lets you fetch + render on
   the server and skip the round-trip.

## What we ship

```tsx
// app/[locale]/(marketing)/privacy/page.tsx — server component (default)
import { project_config } from "@/config/project"

export default function PrivacyPage() {
  return (
    <main>
      <h1>Privacy</h1>
      <p>The {project_config.project_name} team takes data seriously...</p>
    </main>
  )
}
```

No `"use client"`. No JS bundle for this route. Server renders the
HTML at build time (or per-request); browser shows it immediately.

When client interactivity is genuinely needed:

```tsx
// app/[locale]/(dashboard)/account/page.tsx
"use client"

import { useEffect, useState } from "react"
import { useApi } from "@/hooks/use-api"
// ... reads Clerk session, fetches /me, drives the consent toggle.
```

`"use client"` only because:
- Clerk's `useAuth()` is a client hook.
- The consent toggle is a form with `useState`.
- The data fetch + UI feedback are coupled (TanStack Query).

## The decision tree

For each page / component:

1. **Does it use `useState`, `useEffect`, `onClick`, Clerk hooks, or
   browser APIs?** → client component.
2. **Does it embed a client component?** → can stay server; the
   client island is rendered locally.
3. **Otherwise** → server component.

The rule the shipped tree follows, without exception:

- **Every `(marketing)` page is a server component** — the landing
  page, pricing, the blog and its post pages, and the legal set
  (privacy, terms, refund, cookies, subprocessors, unsubscribed).
- **Every `(dashboard)` page is a client component** — account,
  billing, and the admin pages — because each one reads the Clerk
  session and drives a fetch with local state.
- **The sign-in and sign-up routes are server components.** They
  render Clerk's own widget, which brings its own client boundary;
  the route wrapping it does not need one.
- **Layouts are server components**, wrapping client providers.

So the marketing surface, the legal pages and the layouts ship no
route-level JS at all, and the client bundle is scoped to the pages
behind authentication.

## Trade-offs

- **`useTranslations()` is server-safe**. next-intl ships an
  isomorphic API; server components can localise without going
  client. Important factory invariant — losing it would force every
  localised page to be client.
- **Auth-gated server pages**. A server component CAN call
  `auth()` from Clerk to read the JWT server-side. The factory's
  current pattern is client-fetch-then-render-or-redirect; a future
  pass could move some pages to server-auth for a 100ms latency win.
- **Form actions** (Server Actions) are available but the factory
  doesn't ship any yet — the bearer-token API model needs more
  thought before Server Actions integrate cleanly.

## What you don't get

RSC has rough edges:
- **Context providers must be client**. `QueryProvider`,
  `ThemeProvider`, `ClerkProvider` are all `"use client"` —
  unavoidable.
- **Suspense streaming** works but has quirks with Tailwind's
  CSS-in-JS (rare in factory; we use Tailwind compile-time).
- **Build-time pre-render** can break if a server component
  inadvertently imports a client-only library (e.g. `localStorage`
  shim). The factory's lint config catches the common offenders
  but not all.

## Receipts

- Server-component routes:
  `frontend/src/app/[locale]/(marketing)/`,
  `frontend/src/app/[locale]/layout.tsx`.
- Client-component routes:
  `frontend/src/app/[locale]/(dashboard)/`,
  `frontend/src/app/[locale]/sign-in/`,
  `frontend/src/components/providers/`.

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `docs/recipes/why-server-components.md`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two, which is what makes naming that version honest.

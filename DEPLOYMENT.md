# Deployment

`https://docs.thefabrica.dev` is this repository, built by Vercel from
`main`. That is the whole of it, and the shortness is the point.

## What the production build may touch

This repository, and nothing else.

The build reads `content/`, `app/`, `examples/` and `scripts/`. It holds no
credential, makes no authenticated request, and has no dependency on
`webrot9/thefabrica` or `webrot9/thefabrica-www` — no token, no GitHub App,
no submodule, no runtime fetch. **No extraction or publication happens at
deploy time.** The generated tree under `content/` was produced on a
maintainer's machine, reviewed as a diff, and committed before it ever
reached a build.

If a deployment ever needs access to a private repository, something has
gone wrong with the design rather than with the deployment.

## Settings

| | |
|---|---|
| Framework preset | Next.js (auto-detected) |
| Build command | `npm run build` (project default) |
| Install command | `npm ci` (project default) |
| Output | `.next` (project default) |
| Environment variables | none |
| Production branch | `main` |

`npm run build` runs the drift guards before `next build`. Vercel builds from
`main` without running this repository's GitHub Actions, so without that the
production build would happily ship a tree that fails `npm run check` — a
hand-written page whose inlined code no longer matches the file it claims to
inline, or a `content/` tree mixing two exports.

## The domain

`thefabrica.dev` is registered at Namecheap and uses Namecheap's
nameservers (`dns1`/`dns2.registrar-servers.com`). The apex and `www` point
at Vercel and belong to the **storefront** project; they are not this
project's concern and must not be changed by anything here.

`docs.thefabrica.dev` is a `CNAME` at Namecheap pointing at the target
Vercel gives when the domain is added to this project. Take the value from
Vercel rather than from memory: Vercel issues a per-project target for new
domains, and the older shared `cname.vercel-dns.com` is not always what it
asks for.

## Adding the domain, once

1. Vercel → New Project → import `webrot9/thefabrica-inspect`. Accept the
   detected Next.js settings; add no environment variables.
2. Project → Settings → Domains → add `docs.thefabrica.dev`. Vercel shows
   the exact record it wants.
3. Namecheap → Domain List → thefabrica.dev → Advanced DNS → add that
   record, host `docs`. Leave every existing record alone: the apex `A` and
   the `www` `CNAME` belong to the storefront.
4. Wait for Vercel to report the domain valid; it issues the certificate
   itself.

A separate Vercel project from the storefront, deliberately. The two
repositories deploy on their own schedules, and the storefront's build needs
environment variables this one must never have.

# The Fabrica — public documentation

This repository is the source of **the engineering documentation for
[The Fabrica](https://www.thefabrica.dev/)**, a commercial FastAPI +
Next.js SaaS foundation. It is also the site that serves it.

It exists to answer one question before anyone spends anything:

> Is this engineered well enough that I would trust it as the foundation
> of my product?

## Most of this repository is generated

Almost every page under `content/` is **extracted from the private product
repository**, not written here. Passages are marked at the source, an
allowlist names which files may be published and to what route, and a tool
reads the marked regions out of a git ref and writes this tree. Publication
is a diff a human reads before it becomes a commit.

The reason is drift. This repository used to carry hand-written public
excerpts, and by the time they were retired one of them described the
credit ledger more accurately than the private document did, while another
claimed file counts that had not been true for months. An excerpt nobody
regenerates is a claim nobody rechecks.

Files that say `GENERATED FILE — DO NOT EDIT` mean it. Editing one here
produces a change that the next export silently reverts. The source is in
the private repository; the exporter is in the private storefront
repository. Neither of them can write to this one, and nothing here can
read either of them:

| Repository | Owns |
|---|---|
| `thefabrica` (private) | the documentation source and the `public:` markers |
| `thefabrica-www` (private) | the exporter and the publication allowlist |
| **this one** (public) | the generated tree, the site, and the pages no document can carry |

There is no token, no GitHub App, no submodule and no workflow anywhere
that moves content from private to public. A human runs the exporter and
opens a pull request.

## What is hand-written

Two kinds of page, both of them evidence that no prose extract could
carry, and both declared in the publication allowlist so the generated
sidebar still lists everything:

- `content/index.mdx` — the front page.
- `content/receipts/example-resource.mdx` — the six files a scaffolded
  resource arrives as, inlined from `examples/owned-resource/` and checked
  against them on every build by `scripts/check-examples.mjs`.
- `content/receipts/ledger-concurrency.mdx` — the concurrency test that
  backs the credit-ledger claim, and its output.

## What is not here

The setup and deployment procedures, the compliance document set, the
scaffold templates, the operational how-tos and the troubleshooting
catalogue. They are what a licence buys, and their absence is enforced by
tests in the storefront repository rather than by intention: adding one to
the publication allowlist fails that build.

Nothing here is runnable as a product, and none of it is open source. See
[`NOTICE.md`](NOTICE.md) — the absence of a `LICENSE` file is deliberate
rather than an oversight.

## Running the site

```bash
npm ci
npm run build          # Next.js 15 + Nextra 4
npm run check          # the drift guards, no network, no secrets
npm run dev
```

The build reads this repository and nothing else. It holds no credential,
makes no authenticated request, and has no dependency on a private
repository at build time or at request time.

---

**The Fabrica** — <https://www.thefabrica.dev/>

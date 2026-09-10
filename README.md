# The Fabrica — public documentation

This repository is the source of **the engineering documentation for
[The Fabrica](https://www.thefabrica.dev/)**, a commercial FastAPI +
Next.js SaaS foundation. It is also the site that serves it, at
<https://docs.thefabrica.dev>.

It exists to answer one question before anyone spends anything:

> Is this engineered well enough that I would trust it as the foundation
> of my product?

## Most of this repository is generated

Almost every page under `content/` is **extracted from the product's own
documentation**, not written here. Passages are explicitly marked for
publication at the source, a maintainer runs the extraction, and the result
lands here as a pull request somebody reads before it merges.

The reason is drift. This repository used to carry hand-written summaries of
the product's documentation, and by the time they were retired one of them
described the credit ledger more accurately than the document it was
summarising, while another claimed file counts that had not been true for
months. A copy nobody regenerates is a claim nobody rechecks.

Files that say `GENERATED FILE — DO NOT EDIT` mean it. Editing one here
produces a change that the next extraction silently reverts. Each page names
the product version it describes and the documentation commit it came from,
so a claim on this site can be tied to a specific state of the product.

## What is written here

Four pages, because no extracted passage could carry them:

- `content/index.mdx` — the front page.
- `content/extending/opinionated-and-replaceable.mdx` — which decisions a
  buyer inherits, which are load-bearing, and what replacing each one
  touches. An evaluation *across* the corpus, which no single document can
  make about itself.
- `content/receipts/example-resource.mdx` — the six files a scaffolded
  resource arrives as, inlined from `examples/owned-resource/` and checked
  against them on every build by `scripts/check-examples.mjs`.
- `content/receipts/ledger-concurrency.mdx` — the concurrency test behind
  the credit-ledger claim, and its output.

## What is not here

The setup and deployment procedures, the compliance document set, the
scaffold templates, the operational how-tos and the troubleshooting
catalogue. They are what a licence buys.

Nothing here is runnable as a product, and none of it is open source. See
[`NOTICE.md`](NOTICE.md) — the absence of a `LICENSE` file is deliberate
rather than an oversight.

## Running the site

```bash
npm ci
npm run build          # Next.js 15 + Nextra 4
npm run check          # the drift guards
npm run dev
```

The build reads this repository and nothing else. It holds no credential and
makes no authenticated request.

---

**The Fabrica** — <https://www.thefabrica.dev/>

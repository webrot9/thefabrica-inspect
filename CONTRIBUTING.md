# Editing this repository

Read this before changing anything under `content/`.

## Most pages cannot be edited here

Every file under `content/` that opens with `GENERATED FILE — DO NOT EDIT`
is extracted from the private product repository. Editing one here is
worse than pointless: the change looks applied, survives review, and is
silently reverted by the next export.

To change a generated page, change the documentation it came from. The
page names both the source file and the commit:

```markdown
> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `docs/recipes/why-credit-ledger.md`
```

Then a maintainer re-runs the exporter and opens a pull request here.
Nothing is automated across the repository boundary: no token, no GitHub
App, no submodule, no workflow. The reviewable diff *is* the control.

## What can be edited here

- `content/index.mdx` — the front page.
- `content/extending/opinionated-and-replaceable.mdx` — an evaluation page.
  Every product claim on it must trace to current source or to a generated
  page on this site. Do not soften a verdict without re-reading the code
  that produced it.
- `content/receipts/example-resource.mdx` — inlines the files in
  `examples/owned-resource/`. Change the `.py` file and re-inline it;
  `npm run check` fails if the two disagree.
- `content/receipts/ledger-concurrency.mdx` — a test transcript. If the
  test or its numbers change, re-run it and paste real output. Do not
  update the prose alone.
- The site itself: `app/`, `next.config.mjs`, `mdx-components.js`,
  `scripts/`, and this file.

These four pages are hand-written because no marked region could carry
them — code and test output are not prose, and an evaluation *across* the
corpus is not something any one document can say about itself. They are still declared in the
publication allowlist, so the generated sidebar lists them rather than the
theme appending them wherever it likes.

## Before you push

```bash
npm run check     # drift guards
npm run build     # a page that fails to prerender is a page nobody reads
```

## What must never appear here

A credential, a token, a submodule, a workflow with write access to
another repository, or any build step that reads the private repository.
This site must remain buildable and checkable by anyone who can clone it.

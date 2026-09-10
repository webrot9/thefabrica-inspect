# Editing this repository

Read this before changing anything under `content/`.

## Most pages cannot be edited here

Every file under `content/` that opens with `GENERATED FILE — DO NOT EDIT`
is extracted from the product's own documentation. Editing one here is worse
than pointless: the change looks applied, survives review, and is silently
reverted by the next extraction.

To change a generated page, the product documentation has to change. The page
names the document it came from and the commit it was taken at, in a footer,
which is enough to find it. A maintainer re-runs the extraction and opens a
pull request here.

## What can be edited here

- `content/index.mdx` — the front page.
- `content/extending/opinionated-and-replaceable.mdx` — an evaluation page.
  Every product claim on it must trace to the product's current source or to
  a generated page on this site. Do not soften a verdict without re-reading
  what produced it.
- `content/receipts/example-resource.mdx` — inlines the files in
  `examples/owned-resource/`. Change the `.py` file and re-inline it;
  `npm run check` fails if the two disagree.
- `content/receipts/ledger-concurrency.mdx` — a test transcript. If the test
  or its numbers change, paste real output. Do not update the prose alone.
- The site itself: `app/`, `next.config.mjs`, `mdx-components.js`,
  `scripts/`, and this file.

## Before you push

```bash
npm run check     # drift guards
npm run build     # a page that fails to prerender is a page nobody reads
```

`npm run build` runs the guards first, so a build that succeeds is a build
whose hand-written pages still match the files they quote.

## What must never appear here

A credential or token, a workflow with write access to another repository, or
any build step that reads something this repository does not contain. This
site must remain buildable and checkable by anyone who can clone it.

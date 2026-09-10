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
- The site itself: `app/`, `lib/`, `next.config.mjs`, `mdx-components.js`,
  `scripts/`, and this file.

## The icons

`app/favicon.ico`, `app/icon.png` and `app/apple-icon.png` are the
product's brand mark — the same woven mark the storefront uses, at the
sizes Next.js picks up by filename and writes `<link>` tags for. They are
binaries rather than a drawing script because this is not where the mark
is designed: it is generated from the brand palette elsewhere and copied
here, so changing it here would put the two sites out of step. Nothing
else in the site references them.

## What is generated at build time

`npm run build` writes four things before and after `next build`, none of
which is committed:

- a Markdown copy of every page at `<route>.md`, so a reader that wants the
  words rather than the document can fetch them;
- `llms.txt`, the curated map of the site for a machine reading it;
- `lib/pages.json`, the page inventory the sitemap and the breadcrumbs read;
- `public/_pagefind/`, the search index, built from the prerendered HTML.

All four come from `lib/inventory.mjs`, which reads `content/` and the
generated sidebar files. There is no second list of pages anywhere, and
adding one is how a withdrawn page goes on being advertised.

`public/8f4d…txt` is the exception beside them: it is the IndexNow key, it
is not generated, and it is committed because it has to be served. IndexNow
keys are public by design — the protocol validates a submission by fetching
that file.

After a deployment is live, `npm run indexnow` shows which canonical URLs
have appeared, changed or gone since the last submission; `npm run indexnow
-- --submit` sends exactly those and updates
`scripts/indexnow-state.json`, which is then committed. It is a manual
command on purpose: submitting a URL before the deployment that serves it is
worse than submitting nothing.

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

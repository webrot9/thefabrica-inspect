---
title: "Taking an update"
description: "What a release merge does to a codebase shaped like this one."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica v0.1.2 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# Taking an update

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

## What `_domain/` protects

Your product code belongs in the reserved `_domain/` directories:

```
backend/src/models/_domain/            backend/src/prompts/_domain/
backend/src/api/routers/_domain/       backend/src/scrapers/_domain/
backend/src/services/_domain/          backend/data/seed/_domain/
backend/src/workers/tasks/_domain/
frontend/src/components/_domain/
frontend/src/app/[locale]/(dashboard)/(_domain)/
```

Upstream ships only convention files in those directories — a `.gitkeep`
in every one, and a `README.md` in most. **A file you create there has no
upstream counterpart**, so a merge has nothing to reconcile it against and
leaves it exactly as you wrote it.

That is the whole guarantee, and it is a real one: in a test update
performed against a scratch clone of this repository, buyer-created files
under `models/_domain/`, `api/routers/_domain/` and
`components/_domain/` came through a conflicted merge byte-for-byte
unchanged.

## What `_domain/` does NOT protect

This is the part that matters, because the protection above is narrower
than it sounds.

**It reduces the surface a merge can collide with. It does not make
updates conflict-free.** `_domain/` is a naming convention and an
ownership boundary — there is no dynamic loading, no manifest, no
registry, and nothing that isolates you from Git.

**Upstream does write inside `_domain/` directories.** It owns the
`README.md` and `.gitkeep` there. In the test update, upstream's change
to `models/_domain/README.md` merged in cleanly — but if you had edited
that README yourself, it would have conflicted like any other file. Your
files in those directories are yours; the directories are not.

**Every factory file outside `_domain/` merges normally.** If you edited
`services/email.py` and upstream also changed it, you get an ordinary
conflict. Nothing about this repository changes that.

**Wiring files are the predictable collision point.** Registration here
is explicit by design — a model is imported in
`backend/src/models/__init__.py`, a router is mounted in
`backend/src/api/main.py`. That buys a statically analysable import graph,
and it costs you a line in a shared file for every resource you add.
Those shared files are edited by you *and* by upstream, so they are where
conflicts concentrate.

`backend/src/models/__init__.py` is worth understanding specifically,
because registering one model touches it **twice** — the import block and
the `__all__` list. Both are conflict candidates, independently:

> In the test update, the buyer and upstream each registered a new model.
> The **import block merged automatically** (the two inserts landed at
> different anchor lines), while `__all__` **conflicted** (both inserts
> landed immediately after `"ApiKey",`). Same file, same change, same
> release: one region merged itself, the other did not.

There is no rule to memorise there. Whether you get a conflict depends on
where in the block the two edits landed, which is why this guide will not
tell you which releases apply cleanly.

## Common failure modes

**`ruff` fails on an import block you never touched.** Two independent
imports merged into one block, out of order. `ruff check --fix` handles
it. Expect this on any update that adds a model, router or service.

**A conflict in `models/__init__.py` or `api/main.py`.** Expected, by
design, and usually "keep both". Explicit wiring is the trade this
codebase makes for a statically analysable import graph.

**`alembic upgrade head` fails with multiple heads.** Upstream added a
migration and so did you, from the same parent, so the chain has two
tips:

```
FAILED: Multiple head revisions are present for given argument 'head';
please specify a specific target revision, '<branchname>@head' to narrow
to a specific head, or 'heads' for all heads
```

`uv run alembic heads` shows both. Join them with
`uv run alembic merge heads -m "merge upstream migrations"`, then
upgrade. **That command writes a new revision file under
`backend/alembic/versions/`** — it is source, and it must be committed on
the update branch like any other integration fix. Read
[`migrations/safe-migrations.md`](../operating/migrations) before
doing this against a database with real data in it.

**Tests fail on code you did not write.** Read the incoming commits:
`git log HEAD@{1}..HEAD --oneline`. An upstream change to a factory
invariant — the repository base class, `deps.py`, the settings — can
require a matching change in `_domain/` code that depends on it. This is
a real cost of updating, and the recipes for the changed files explain
what the invariant is protecting.

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `docs/upstream-updates.md`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two — the exporter refuses to name a product version otherwise.

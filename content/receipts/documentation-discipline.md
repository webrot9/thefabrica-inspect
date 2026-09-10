---
title: "How these documents are maintained"
description: "Receipts must resolve, counts are held to the filesystem, claims are guarded by tests."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# How these documents are maintained

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `docs/README.md`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

## Doc conventions (for contributors + agents)

1. Every recipe ends with a **Receipts** section listing the exact
   code paths it describes. Those paths must exist — verify with `ls`
   before committing ("never write receipts from memory").

3. A recipe is 2–3 sections: competitor/naive pattern, our pattern,
   receipts. 60–150 lines is the sweet spot.
4. When code changes a documented behaviour, update the doc in the
   same PR.
5. Some documents carry `<!-- public:begin -->` / `<!-- public:end -->`
   markers. They delimit the regions a maintainer may extract for the
   published documentation site, they render to nothing, and a passage
   outside them is private by default — extraction is opt-in, so an
   unmarked document publishes nothing. Moving one changes what is
   published, so treat it as a content change rather than formatting.
   `backend/tests/test_public_markers.py` checks that they stay balanced
   and never end up inside a code fence; the tooling that reads them is
   maintained outside this repository.
6. Don't hand-maintain a count of something the filesystem already
   knows. `backend/tests/test_docs_recipe_count.py` holds the recipe
   count in this file, the root README and `CLAUDE.md` to
   `docs/recipes/`; a number without a guard like that goes stale
   silently, so prefer no number at all.

---
title: "How these documents are maintained"
description: "Receipts must resolve, counts are held to the filesystem, claims are guarded by tests."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica v0.1.2 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# How these documents are maintained

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

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

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `docs/README.md`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two — the exporter refuses to name a product version otherwise.

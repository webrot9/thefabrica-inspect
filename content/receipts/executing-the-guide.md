---
title: "What executing our own guide broke"
description: "Six defects found by running the first-resource walkthrough, and their fixes."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# What executing our own guide broke

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `docs/first-resource.md`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

## What this run fixed

Executing this procedure end to end surfaced six defects. All six are
fixed in the same change that added this guide, because a guide that
documents its way around a broken product is not a guide.

1. **The generated tests could not run.** They are written against
   `authed_client` / `other_user_client` / `anon_client`, and no such
   fixtures existed — every one errored on collection. The mandatory IDOR
   regression the scaffold advertises had never executed. The three
   fixtures now ship in `conftest.py`.
2. **PATCH 500'd on every successful update** (`MissingGreenlet`), and
   the test suite could not see it: the IDOR test only PATCHes a foreign
   row, which 404s before the handler body runs. The router template
   refreshes the row; the test template now has a happy-path PATCH.
3. **Buyer dashboard pages were unroutable.** The documented location,
   `app/[locale]/_dashboard/_domain/`, is a Next.js private folder. A
   probe page there produced no route while a control page under
   `(dashboard)/` did:

   ```
   ├ ƒ /[locale]/probe-b     ← (dashboard)/probe-b
   (no probe-a route)        ← _dashboard/_domain/probe-a
   ```

   It is now the route group `(dashboard)/(_domain)/`, which routes and
   inherits the dashboard chrome.
4. **`alembic revision` always failed** with
   `Could not find entrypoint console_scripts.ruff` — after writing the
   file. The post-write hook is now `type = exec`.
5. **The factory's own tests rejected the first buyer resource.**
   `test_db_naming_convention.py` and `test_db_roundtrip.py` pinned the
   table list with `==`, so any `_domain/` model turned the suite red in
   three assertions, none of which mentioned the scaffold. They are
   subset checks now; the round-trip additionally asserts that a
   re-upgrade reproduces the first, which covers buyer migrations too.
6. **A find-and-replace mangled every generated docstring.** The
   templates documented their own placeholders using the literal
   `{{...}}` markers, so substituting multi-line field blocks injected
   them into prose — and with long enough field lists it failed `ruff`
   on line length. The instruction docstrings now name block placeholders
   without braces.

A seventh came from the fresh-clone rehearsal rather than the scaffold:
`test_job_dispatch.py::test_celery_app_uses_project_slug` asserted
`"thefabrica" in app.main`, so the repository's own checks failed for every
buyer the moment `factory-cli init` renamed the project — the supported
first step. It now asserts what `celery_app.py` actually builds,
`f"{project_config.project_slug}-workers"`, with no literal at all.

One thing was found and deliberately **not** fixed at the time:
`alembic revision --autogenerate` reported large pre-existing drift
across eight existing tables (column comments and index definitions the
factory's migrations never wrote). It was unrelated to the scaffold and
reconciling it was a schema change, not a documentation one — so this
guide originally routed around it.

**That drift is now closed.** Migration
`007_schema_metadata_alignment` emitted the 79 missing column comments,
created the `ix_api_keys_created_at` index that `TimestampMixin`
declares, and replaced two redundant constraint/index pairs with the
single unique index the models describe. `alembic check` against a
migrated database now reports nothing to generate, and
`test_migrated_schema_matches_model_metadata` fails the build if that
ever stops being true.

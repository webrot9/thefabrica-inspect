---
title: "The extension boundary"
description: "Where buyer code lives, and precisely what that guarantees."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# The extension boundary

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `docs/recipes/buyer-extension-model.md`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

Every buyer who clones the factory will pull updates from us as long
as we keep shipping fixes. The hard problem is: how do they add their
own code **without** forking + losing the ability to `git pull`?

The factory's answer is the `_domain/` directory pattern. Buyer code
lives in `_domain/` sub-directories under each module; factory code
lives one level up. Upstream does not overwrite the files you create
there, which shrinks the surface an update can collide with — it does
not make updates conflict-free.

## The directories

```
backend/src/
├── api/routers/
│   ├── account.py             # factory
│   ├── billing.py             # factory
│   ├── admin.py               # factory
│   └── _domain/               # ⬅ buyer
│       └── widgets.py
├── models/
│   ├── user.py                # factory
│   ├── subscription.py        # factory
│   └── _domain/               # ⬅ buyer
│       └── widget.py
├── services/
│   ├── email.py               # factory
│   ├── paddle.py              # factory
│   └── _domain/               # ⬅ buyer
│       └── widget_service.py
├── workers/tasks/_domain/     # ⬅ buyer's Celery tasks
├── prompts/_domain/           # ⬅ buyer's LLM prompts
└── scrapers/_domain/          # ⬅ buyer's scrapers (optional)

frontend/src/
├── components/
│   ├── ui/                    # factory primitives (Button, Card, ...)
│   ├── providers/             # factory providers
│   └── _domain/               # ⬅ buyer's React components
└── app/[locale]/
    ├── (dashboard)/account/   # factory page
    ├── (dashboard)/admin/     # factory pages
    └── (dashboard)/(_domain)/ # ⬅ buyer's dashboard pages (a route
                               #    GROUP: `_domain/` alone is a Next
                               #    private folder and never routes)
```

Most `_domain/` directories ship a README.md explaining naming +
skeleton; every one ships a `.gitkeep`. (`data/seed/_domain/` is the one
with no README.)

## Why the underscore prefix

1. **Python convention**: leading underscore = "internal / extension".
   The factory's own `_base.py` and `_internal.py` modules use the
   same convention. `_domain/` follows.
2. **Git-pull-safe, for your files**: the factory ships only
   convention files — a `.gitkeep`, and a `README.md` in most — inside
   each `_domain/`, so a file you create there has no upstream
   counterpart to be overwritten by.
   Note what this does *not* say: upstream does write in those
   directories — it maintains those README files — so an update can
   still conflict there if you have edited or renamed them (see
   [Naming the `_domain/` itself](#naming-the-_domain-itself)).
3. **Sorts last**: `_d` sorts after letters in `ls`. Factory files
   first; buyer dirs last. Reads top-down.
4. **Searchable**: `grep -r _domain backend/src` instantly shows
   "this is buyer code".

## What this is NOT

This is **not** a plugin system. There's no dynamic loading, no
manifest file, no priority resolution. `_domain/` is a naming
convention + READMEs. Buyer code is regular Python / TypeScript
that imports the factory's primitives + ships its own surfaces.

If a buyer needs runtime extensibility (load plugins by buyer name
at startup), they layer that on top — the factory doesn't ship it
because most buyers don't need it.

## Auto-discovery (planned hooks, not yet shipped)

Open question for v0.2.0+: should `_domain/` modules auto-mount?

```python
# Hypothetical hook (not shipped):
for module in iter_modules("src.api.routers._domain"):
    if hasattr(module, "router"):
        app.include_router(module.router, prefix="/api/v1")
```

Pros: zero-boilerplate mounting; buyers `git pull` factory updates
that include the auto-discovery without changing their own code.

Cons: import-time side effects + load-order subtleties; explicit
`include_router` calls are easier to debug ("why isn't this route
returning?" → grep for the include call).

Explicit mounting is what ships today. Auto-discovery is a future
recipe.

## Naming the `_domain/` itself

Some buyers asked: "Can I rename `_domain/` to `_acme/` to match my
brand?". Technically yes — it's just a directory. Trade-offs:

- **Yes, rename**: cleaner reading in your codebase. Cost: future
  factory updates that touch `_domain/` README files conflict; you
  have to grep + rename.
- **No, keep `_domain/`**: nameless, generic. Cost: less branded
  feeling.

The factory's recommendation: keep `_domain/` until you fork. If
you fork (no longer pulling updates), rename freely.

## Test discipline

Tests for `_domain/` code live alongside the factory tests in
`backend/tests/`. Don't shadow factory test names; prefix with your
domain (`test_widget_*.py`).

```
backend/tests/
├── test_account_endpoints.py  # factory
├── test_billing_api.py        # factory
└── test_widget_*.py           # ⬅ buyer
```

`uv run pytest` runs all of them together. Factory test failures on
buyer code = buyer broke factory assumptions; buyer fixes their
side.

## CI considerations

The factory's CI config runs `pytest -m "not integration"`
+ `ruff` + `mypy` + frontend `tsc` + `vitest`. Buyers inherit all of
that — their `_domain/` code is linted/typed/tested by the same
pipeline.

Strict mypy on buyer code is intentional. Loose typing in `_domain/`
infects the factory side via imports + makes the boundary blurry.

## Receipts

- READMEs:
  `backend/src/api/routers/_domain/README.md`,
  `backend/src/models/_domain/README.md`,
  `backend/src/services/_domain/README.md`,
  `backend/src/workers/tasks/_domain/README.md`,
  `backend/src/prompts/_domain/README.md`,
  `backend/src/scrapers/_domain/README.md`,
  `frontend/src/components/_domain/README.md`.

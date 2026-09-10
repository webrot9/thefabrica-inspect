---
title: "The Cursor rule"
description: "The Cursor entry point, below its frontmatter."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Extracted from The Fabrica v0.1.2.
     Edits belong in the product documentation, not here. -->

# The Cursor rule

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

**Read [`CLAUDE.md`](../agents/repository-context) at the repo root and follow
it.** It is this repository's agent instruction file and it applies to
you: treat its contents as if they were written here. Do not change
anything non-trivial before you have read it.

It is the canonical file for every agent — Cursor, Claude Code and
Codex are all directed to the same one, so there is one set of
instructions rather than three that drift.

It covers: the stack and where things live; the deterministic scaffold
for a new user-owned resource; the verification commands (ruff /
`mypy --strict` / pytest / npm lint + type-check + test) and why
generating the code is not finishing the task; the load-bearing
invariants — repository-mediated reads, the append-only credit ledger,
webhook idempotency, JSON-only Celery, `AuditLog`; the `_domain/`
convention that decides which of your files an upstream release leaves
alone; and the GDPR obligations that travel with a schema change.

Two rules worth having in context before you read it:

- **Your product code goes in a `_domain/` directory.** Factory code
  lives one level up and is what you will resolve by hand on every
  upstream merge. `CLAUDE.md` lists every reserved path.
- **Reads go through the repository layer.** Each user-owned resource
  declares `get_for_user` / `list_for_user` on its own repository under
  `backend/src/services/repositories_async/`, so that resource's
  ownership filter lives in one place. The shared `base.py` exposes no
  ownership-aware read on purpose. A bare `session.get(Model, id)` in a
  router is an IDOR bug.

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `.cursor/rules/fabrica.mdc`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two, which is what makes naming that version honest.

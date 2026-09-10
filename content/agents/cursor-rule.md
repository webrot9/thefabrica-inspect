---
title: "The Cursor rule"
description: "The Cursor entry point, below its frontmatter."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# The Cursor rule

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `.cursor/rules/fabrica.mdc`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

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

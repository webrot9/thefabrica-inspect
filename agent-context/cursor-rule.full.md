# `.cursor/rules/fabrica.mdc` — published in full

This is the complete Cursor rule from the licensed repository at
release `thefabrica-v0.1.2`, including its frontmatter. Nothing is cut.

It is reproduced inside a code fence, and it does not live under a
`.cursor/rules/` path in this repository, so Cursor will not apply it
to anyone who opens the inspection repository.

```markdown
---
description: The Fabrica — where product code goes, what not to break, how to verify
alwaysApply: true
---

# The Fabrica — read `CLAUDE.md` first

**Read [`CLAUDE.md`](../../CLAUDE.md) at the repo root and follow
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
- **Reads go through the repository layer**
  (`backend/src/services/repositories_async/base.py`), so the ownership
  filter lives in one place. A bare `session.get(Model, id)` in a
  router is an IDOR bug.
```

## What to look at

`alwaysApply: true` in the frontmatter is the load-bearing line. Cursor
supports rules that apply only when a glob matches or when the model
decides they are relevant; this one is in context for every request in
the repository, with no per-file trigger to get wrong.

Then the same instruction as `AGENTS.md`, in the same imperative form:
read `CLAUDE.md` and follow it, treat it as if written here.

The two rules restated at the end are there because they are the ones
most expensive to discover late — where your code goes, and that reads
go through the repository layer so the ownership filter lives in one
place. You can check the second one against
[`../examples/owned-resource/repository.py`](../examples/owned-resource/repository.py),
which is generated output from the same private repository, and against
[`../extension-model/README.md`](../extension-model/README.md) for the
first.

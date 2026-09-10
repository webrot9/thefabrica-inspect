---
title: "AGENTS.md, in full"
description: "The Codex entry point, reproduced whole."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# AGENTS.md, in full

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `AGENTS.md`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

**Read [`CLAUDE.md`](../agents/repository-context) now and follow it.** It is this
repository's agent instruction file and it applies to you: treat its
contents as if they were written here. Do not change anything
non-trivial before you have read it.

`AGENTS.md` is the cross-tool convention (Codex and others),
`CLAUDE.md` is what Claude Code reads, and
[`.cursor/rules/fabrica.mdc`](../agents/cursor-rule) is what Cursor
reads. All three direct you to the same canonical file, so there is one
set of instructions rather than three that drift.

`CLAUDE.md` covers: the stack, how to add a resource with the
deterministic scaffold, the verification commands (ruff /
mypy --strict / pytest / npm lint+type-check+test) and why generating
the code is not finishing the task, the load-bearing invariants you
must not break — including the append-only credit ledger and webhook
idempotency — the `_domain/` extension convention that decides which
of your files an upstream release leaves alone, and the GDPR
compliance obligations.

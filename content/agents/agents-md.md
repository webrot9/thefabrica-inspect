---
title: "AGENTS.md, in full"
description: "The Codex entry point, reproduced whole."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Extracted from The Fabrica v0.1.2.
     Edits belong in the product documentation, not here. -->

# AGENTS.md, in full

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

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

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `AGENTS.md`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two, which is what makes naming that version honest.

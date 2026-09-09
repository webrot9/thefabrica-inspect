# `AGENTS.md` — published in full

This is the complete `AGENTS.md` from the licensed repository at
release `thefabrica-v0.1.2`. Nothing is cut. Publishing it whole is the
point: an excerpt could not show that the file is *only* a pointer.

It is reproduced inside a code fence, and this directory contains no
file named `AGENTS.md`, so nothing here is a live instruction to an
agent reading the inspection repository.

```markdown
# AGENTS.md

**Read [`CLAUDE.md`](CLAUDE.md) now and follow it.** It is this
repository's agent instruction file and it applies to you: treat its
contents as if they were written here. Do not change anything
non-trivial before you have read it.

`AGENTS.md` is the cross-tool convention (Codex and others),
`CLAUDE.md` is what Claude Code reads, and
[`.cursor/rules/fabrica.mdc`](.cursor/rules/fabrica.mdc) is what Cursor
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
```

## What to look at

The opening sentence is an instruction, not a description: *read
`CLAUDE.md` now and follow it*, and *treat its contents as if they were
written here*. The difference matters — a file that says "this
repository also has a `CLAUDE.md`" leaves the agent to decide whether
to open it.

The rest of the file is a table of contents for a document it does not
duplicate. Twenty-one lines against 229 in `CLAUDE.md`: it stays a
pointer instead of becoming a second set of instructions that can
disagree with the first.

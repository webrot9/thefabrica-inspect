# Agent context

Claude Code, Codex and Cursor each support repository-level
instruction/context files. The Fabrica ships an entry point for all
three and keeps `CLAUDE.md` as the canonical source.

Each of the three looks for a different filename. A repository that
ships none of them lets the agent infer the architecture from whatever
files it happens to read first; a repository that ships three separate
sets of instructions has three answers that drift apart within a
release or two.

| Agent | File it reads | What it is |
|--|--|--|
| Claude Code | `CLAUDE.md` (repository root) | the canonical context — 229 lines at `thefabrica-v0.1.2` |
| Codex, and other agents following the `AGENTS.md` convention | `AGENTS.md` (repository root) | 21 lines: read `CLAUDE.md` and follow it |
| Cursor | `.cursor/rules/fabrica.mdc` | 34 lines, `alwaysApply: true`: read `CLAUDE.md` and follow it |

This is a property of the repository, not of a prompt: nothing is
pasted in at the start of a session. The two short entry points do not
duplicate the canonical instructions — they direct the agent to them —
so there is one substantive document to keep current rather than three.

## What is here

- [`agents-md.full.md`](agents-md.full.md) — the complete `AGENTS.md`.
- [`cursor-rule.full.md`](cursor-rule.full.md) — the complete Cursor
  rule, frontmatter included.
- [`claude-md.excerpts.md`](claude-md.excerpts.md) — labelled excerpts
  from the canonical file — 75 lines of 229 — covering
  architecture, the `_domain/` boundary, representative production
  invariants, the verification expectation, and upstream updates. What
  was cut is listed on that page with the reason.

The two pointers are published whole because an excerpt cannot prove
what matters about them: that they *instruct* rather than mention, and
that they stay short enough to remain pointers instead of becoming a
second and third set of instructions. The canonical file is not
published whole, because most of what is missing is the licensed
product — the scaffold procedure, the compliance obligations, the setup
CLI.

All three are reproduced inside code fences, and none of them is at a
path an agent loads: there is no `AGENTS.md` and no `.cursor/rules/`
directory in this repository. Opening the inspection repository in an
agent gives it nothing to follow, which is correct — this is not a
working copy of the product.

## What this does not claim

Not that an agent builds the product. The claim is narrower and
mechanical: the agent starts from the production decisions that were
already made and written down, instead of rediscovering them from a
blank repository — and getting the ownership filter, the credit ledger
or a migration wrong in a way that reads plausibly and passes review.

The reader of these files is still a developer. `CLAUDE.md` is written
to be read by a person as easily as by an agent, and the verification
section exists precisely because "the agent said it was done" is not a
result.

## How to check this claim

Structural, so it needs nothing running — given access to the private
repository at a release tag:

1. Confirm all three files exist at the repository root and at
   `.cursor/rules/fabrica.mdc`.
2. Confirm the two short ones open with an instruction to read and
   follow `CLAUDE.md`, and that neither restates its content at length.
3. Confirm `alwaysApply: true` in the Cursor rule's frontmatter — a
   rule that applies on a glob or on the model's judgement is a
   different and weaker claim.
4. Diff the excerpts on
   [`claude-md.excerpts.md`](claude-md.excerpts.md) against the real
   `CLAUDE.md` at `thefabrica-v0.1.2`. They should match byte for byte,
   with cuts only where the page marks them.
5. Check that the arrangement is held in place by a test rather than by
   habit: `backend/tests/test_agent_context.py`.

If any of these fails, the claim on this page is wrong and should be
challenged.

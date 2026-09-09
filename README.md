# The Fabrica — Inspection Repository

This repository is a curated, source-visible window into selected
engineering decisions and generated examples from **The Fabrica**, a
commercial FastAPI + Next.js SaaS foundation.

It exists to answer one question before you spend anything:

> Is this codebase engineered well enough that I would trust it as the
> foundation of my product?

## What this is not

- **Not the source repository.** The product lives in a private
  repository that licensees are given access to.
- **Not runnable.** Nothing here builds, installs or starts. The
  examples import factory primitives that are deliberately absent.
- **Not a free tier, community edition, or open-source release.** See
  [`NOTICE.md`](NOTICE.md) — there is no open-source licence here, and
  that omission is intentional rather than an oversight.
- **Not a source dump.** It does not contain the billing
  implementation, the credit-ledger implementation, the compliance
  bundle, the setup CLI, the scaffold templates, or the private
  recipes.

What it does contain is chosen so that the claims are **falsifiable**:
enough real code and real reasoning to disagree with, rather than a
feature list.

## Built to work with coding agents

A licensed repository ships the instruction file each coding agent
already looks for: `CLAUDE.md` for Claude Code, `AGENTS.md` for Codex
and other agents following that convention, `.cursor/rules/fabrica.mdc`
for Cursor. The two short ones instruct the agent to read and follow
`CLAUDE.md`, so there is one canonical set of instructions rather than
three that drift.

That canonical file carries the architecture and where things live; the
`_domain/` extension boundary; the production invariants that are
expensive to get wrong — the append-only credit ledger, webhook
idempotency, ownership filtering in the repository layer; the
verification commands and the expectation that generating code is not
finishing the task; and the procedure for taking an upstream update.

The point is not that an agent generates the product for you. It is
that your agent starts from explicit production context instead of
rediscovering those decisions from a blank repository — which is where
a plausible-looking diff quietly gets the ownership filter or the
ledger wrong. The audience is still the developer doing the reviewing.

The mechanism is inspectable in [`agent-context/`](agent-context/).

## Reading path

Five items, in this order. Each is meant to prove something specific.

### 1. [`examples/owned-resource/`](examples/owned-resource/)

Six files — model, migration, schema, repository, router, tests — for a
fictional `SavedSearch` resource, rendered from the private scaffold
that generates every user-owned resource in the product.

*What it proves:* that generated code arrives with its security
properties already in place. Ownership is filtered in SQL in a single
repository rather than re-checked per endpoint; a foreign row answers
404 rather than 403; the foreign key cascades on user deletion; the
`(user_id, created_at)` index exists because listing "my rows" is the
query that will actually run; every state change writes an audit
record; and the generated test suite includes the IDOR regression test
that fails the moment someone drops the ownership filter.

Start with `repository.py`, then `test_resource.py`.

### 2. [`extension-model/README.md`](extension-model/README.md)

How buyer code and factory code are kept apart so that upstream updates
remain takeable.

*What it proves:* that the upgrade path was designed rather than hoped
for — and that the boundary is described precisely, including where the
guarantee is narrower than the convenient phrasing.

### 3. [`decisions/`](decisions/)

Two load-bearing decisions, written up with their failure modes and
their costs: [why credits are a
ledger](decisions/why-credit-ledger.md) rather than a counter, and [why
webhook handling is idempotent by
construction](decisions/why-webhook-idempotency.md).

*What they prove:* that the concurrency and at-least-once-delivery
problems were understood before they were hit, and that the trade-offs
are stated rather than hidden.

### 4. [`receipts/`](receipts/)

[A concurrency test](receipts/credit-ledger-concurrency-test.md)
described in enough detail to know what it would take to break it.

*What it proves:* that the ledger claim is tested, not asserted.

### 5. [`agent-context/`](agent-context/)

The two pointer files in full, and labelled excerpts from the canonical
`CLAUDE.md`, taken from release `thefabrica-v0.1.2`.

*What it proves:* that the orientation above is a property of the
repository rather than of a prompt someone remembered to paste.
`AGENTS.md` and the Cursor rule are published whole — the only way to
show that they instruct rather than mention, and that they stay
pointers instead of becoming a second and third set of instructions.
The `CLAUDE.md` excerpts show what the agent is actually handed on the
five topics the claim rests on, with every cut marked and explained.

Also here: [`TREE.md`](TREE.md), a deliberately incomplete architecture
map, for judging whether the system is coherent as a whole.

## An honest note on what you can verify

Everything on these pages is a vendor describing their own work. The
code samples are real and you can judge them directly. The test receipt
and the architecture map are reports about a repository you cannot see
yet, and they are worth what any such report is worth until you can
read the source — which is what a licence gets you.

The reasoning is offered in a form you can argue with. If a decision
here looks wrong, it probably is worth asking about before buying.

---

**The Fabrica** — <https://www.thefabrica.dev/>

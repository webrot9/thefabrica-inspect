# `CLAUDE.md` — excerpts

`CLAUDE.md` is the canonical file: the one Claude Code reads directly,
and the one `AGENTS.md` and the Cursor rule send every other agent to.
At release `thefabrica-v0.1.2` it is 229 lines.

**This page is excerpts, not the file.** Seventy-five of those 229
lines are reproduced below, chosen to cover the five things the
public claim rests on — architecture, the `_domain/` boundary, production
invariants, the verification expectation, and upstream updates. What
was left out, and why, is listed at the end.

Every excerpt is verbatim inside a code fence, whole paragraphs and
whole list items, never a sentence cut in half. `[…]` marks a cut and
says what is missing.

The rest of the file is part of the licensed product. This page is not
it, and the inspection repository does not contain the working agent
context — only enough of it to check the claim.

---

## 1. Architecture

The opening. It tells the agent what the codebase is before it reads a
line of it, which is the part a blank repository cannot supply.

```markdown
## What this repo is

A production SaaS built on **The Fabrica** — a Python/FastAPI +
Next.js boilerplate. Backend under `backend/`, frontend under
`frontend/`. If you were forked from the factory, the code you see is
the starting point; the buyer extends it for their own product.

Stack: FastAPI + async SQLAlchemy 2.0 + Postgres + Celery + Redis
(backend); Next.js 16 + React 19 + Tailwind + next-intl (frontend);
Clerk (auth), Paddle (payments, Merchant of Record), Resend (email),
Anthropic/OpenAI (LLM).
```

The file also carries a "where things live" map of the tree. It is not
reproduced here; [`../TREE.md`](../TREE.md) is the public counterpart
and is more detailed.

---

## 2. The `_domain/` extension boundary

````markdown
## The `_domain/` convention (buyer code vs factory code)

[… opening paragraph omitted. Two of its claims are accurate — buyer
code lives in `_domain/` subdirectories, factory code one level up —
but it then states that a factory release never creates files inside
`_domain/`, which overstates the upstream guarantee: upstream ships a
`README.md` in eight of the nine reserved directories and may revise
it. The accurate, narrower contract is the one on
../extension-model/README.md — a buyer file lives at a reserved path
where upstream writes no file of that name, so an upstream release
does not overwrite it.]

```
backend/src/models/_domain/          backend/src/api/routers/_domain/
backend/src/services/_domain/        backend/src/workers/tasks/_domain/
backend/src/prompts/_domain/         backend/src/scrapers/_domain/
backend/data/seed/_domain/           frontend/src/components/_domain/
frontend/src/app/[locale]/(dashboard)/(_domain)/
```

The frontend route one is a route **group** — parenthesised. A bare
`_domain/` there is a Next.js *private* folder and never routes, so a
page put in one is silently unreachable.

Protection comes from *where the file lives*, not from the merge:
`_domain/` does not conflict, edits to factory files do. See
[`docs/recipes/buyer-extension-model.md`](docs/recipes/buyer-extension-model.md).
````

Two notes on this excerpt.

**The reserved-directory list is checkable.** Nine paths, and at
`thefabrica-v0.1.2` the private tree contains exactly those nine — each
holding a `.gitkeep`, and eight of the nine a `README.md` documenting
the local convention. The parenthesised `(dashboard)/(_domain)/` is a
Next.js route **group**; a bare `_domain/` in the app router is a
*private* folder that never routes, so the parentheses are load-bearing
rather than stylistic.

**The omission above is the only place on this page where something was
cut for being wrong rather than for being licensed.** It is marked and
explained in place, not trimmed silently, because the sentence and the
correction are both worth having: the overclaim is the convenient
phrasing anyone reaches for, and the narrower contract is what the
shipped code actually gives you.

---

## 3. Production invariants

Ten in the file. Five are reproduced here, chosen because you can check
them against material already in this repository.

```markdown
## Invariants — do NOT change these without a very good reason

These are load-bearing. Changing them cascades:

[… one invariant omitted: migration naming conventions]
- **`backend/src/services/repositories_async/base.py`** — the
  repository pattern. Reads go through `get_for_user` / `list_for_user`
  so the ownership filter lives in ONE place. Direct
  `session.get(Model, id)` in a router is an IDOR red flag.
[… two omitted: the auth-dependency contract, the boot-time guard]
- **Celery serializer = JSON only** (`workers/celery_app.py`). Pickle
  is an RCE vector. Never switch it.
- **`AuditLog` on every privileged action** via
  `services/audit.py:log_action_async`. It's the GDPR Art. 30 surface.

Money, jobs and account lifecycle carry four more. These are the ones
an agent breaks by writing the obvious thing:

- **Credits are an append-only ledger, never a counter column.** Every
  movement is one INSERT into `credit_transactions`; balances are
  derived. A `credits_remaining` column loses races, refunds and the
  audit trail — [`docs/recipes/why-credit-ledger.md`](docs/recipes/why-credit-ledger.md).
- **Every webhook is idempotent.** Paddle retries for days; the
  `processed_webhook_events` + `webhook_events` pair is what makes a
  replay a no-op. Both Paddle and Clerk ride it —
  [`docs/recipes/why-webhook-idempotency.md`](docs/recipes/why-webhook-idempotency.md).
[… two omitted: Paddle-owned subscription state, reversible migrations]
```

The first corroborates
[`../examples/owned-resource/repository.py`](../examples/owned-resource/repository.py)
and the IDOR test beside it. The last two are the subjects of
[`../decisions/why-credit-ledger.md`](../decisions/why-credit-ledger.md)
and
[`../decisions/why-webhook-idempotency.md`](../decisions/why-webhook-idempotency.md),
which are the long-form versions of those two bullets.

The `docs/recipes/…` paths in the excerpt are real paths in the private
repository. Those documents are licensed content and are not published
here; the two decision pages above are the public equivalents for the
two invariants they cover.

---

## 4. Verification, and what "done" means

The file lists the exact commands — `ruff`, `mypy --strict`, `pytest`,
and the frontend `lint` / `type-check` / `test`, at zero-warning
settings — and then says this about them:

```markdown
### Generating the code is not finishing the task

A diff that exists is not a change that works. Before reporting
anything done:

1. Run the checks above that the change could plausibly break — not
   only the ones you expect to pass.
2. Run the tests covering the changed behaviour, and add one if none
   existed. A failing test is information: never delete, skip or
   `xfail` one to reach green.
3. Observe the actual system state, not just the exit code — the row
   in the database, the HTTP response, the rendered page, the queued
   job, the audit entry.
4. Say plainly what you did not verify — an unverified claim of
   completion costs more than an honest gap.
```

This section exists because of one specific failure mode: a task
reported complete on the strength of a diff that was produced and a
command that exited zero.

---

## 5. Taking an upstream update

```markdown
## Taking an upstream update

[`docs/upstream-updates.md`](docs/upstream-updates.md) is the
procedure — follow it rather than improvising a merge. The two things
that go wrong silently: merge an immutable release **tag**
(`thefabrica-vX.Y.Z`) on a branch, never `upstream/main`; and never
fetch upstream tags broadly, or a factory tag clobbers one of yours.
```

Release tags are namespaced (`thefabrica-vX.Y.Z`) because a buyer's
repository is also their own product repository: `git fetch --tags`
maps our `refs/tags/*` into theirs, and an unprefixed `v0.1.0` collides
with one they tagged themselves.

---

## What was left out of these excerpts

Not shown, with the reason:

| Section of `CLAUDE.md` | Why not published |
|--|--|
| How to add a new user-owned resource | The scaffold procedure and its template paths are licensed content. Its *output* is published in full at [`../examples/owned-resource/`](../examples/owned-resource/). |
| Compliance obligations | Points into the compliance document set — RoPA, DPA, DPIA checklist — which the inspection repository deliberately excludes. |
| First-time setup (`factory-cli init`) | The setup CLI is licensed tooling. |
| "Where things live" tree map | Superseded here by [`../TREE.md`](../TREE.md). |
| "First rule: read before you write" | Its content is a pointer into `docs/recipes/`, which is licensed. |
| Troubleshooting pointer, style rules | Not part of the claim this page exists to support. |
| Opening paragraph of the `_domain/` section | The only cut made for accuracy rather than licensing: it overstates the upstream guarantee. Marked and explained in place above, with the narrower contract that does hold. |
| Five of the ten invariants | Migration naming conventions, the auth-dependency contract, the boot-time guard, Paddle-owned subscription state, reversible migrations. Omitted for length, not for sensitivity — four of the five appear in outline in [`../TREE.md`](../TREE.md). |

Nothing was paraphrased or rewritten. Every line inside a fence on this
page is byte for byte what `CLAUDE.md` contains at
`thefabrica-v0.1.2` — with the sole exception of the bracketed `[…]`
markers, which are this page's own and say what is missing where it is
missing.

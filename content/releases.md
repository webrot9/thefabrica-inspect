---
title: "Recent releases"
description: "What counts as a release, and the notes for the two most recent."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Extracted from The Fabrica v0.1.2.
     Edits belong in the product documentation, not here. -->

# Recent releases

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

**What is published here.** The Fabrica's own changelog records every
release; this page carries the detailed notes for **v0.1.2** and **v0.1.1**.
v0.1.0 was the first published release, and its notes are not part of the
published set.

All notable changes to The Fabrica are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each release entry lists changes under these sections:
- **Added** — new features
- **Changed** — changes to existing functionality
- **Deprecated** — soon-to-be-removed features
- **Removed** — features removed this release
- **Fixed** — bug fixes
- **Security** — vulnerability fixes

Breaking changes are flagged with **BREAKING** and include a Migration notes block.

## What counts as a release

A version here is published only when an immutable
`thefabrica-vX.Y.Z` Git tag exists for it. The rules, so that "the
updates we publish" names something a buyer can actually pin to:

- A release is a **tag**, not a branch state. `main` is current
  development source and is never a published release.
- Release tags are **namespaced** `thefabrica-vX.Y.Z`. The buyer's
  repository is also their own product repository, and `git fetch
  --tags` maps our `refs/tags/*` into theirs. An unprefixed `v0.1.0`
  collides with a `v0.1.0` they tagged themselves: the fetch is
  rejected, so our release is unfetchable, and the `--force` they will
  reach for next overwrites their tag with ours. The prefix is what
  keeps both intact. The version itself stays plain `0.1.0` everywhere
  else — `pyproject.toml`, `package.json`, this file.
- The tag points at a commit on `main` that passed the full
  verification: lint, strict typing, tests, both backend and frontend.
- Tags are **immutable**: never moved, never deleted, never reused. A
  mistake in a release is fixed by publishing the next version.
- The version in this file, the tag, and the version fields in
  `pyproject.toml`, `frontend/package.json`, `bin/factory-cli/` and
  `docs-site/package.json` all agree.
- Buyer-facing documentation points at tags, never at `main`.

No release cadence is promised. Releases happen when there is something
worth tagging.

---

## [0.1.2] — 2026-09-09

A fresh clone now carries first-class repository context for the coding
agent the buyer opens it in. Claude Code, Codex and Cursor each read the
file they already look for, and all three are directed to one canonical
`CLAUDE.md` — so the agent starts with the architecture, the extension
boundaries, the invariants and the verification expectations instead of
inferring them. Nothing to run first, and no application behaviour
changed.

### Added

- **Cursor reads the same agent context as Claude Code and Codex.**
  The factory shipped `CLAUDE.md` (Claude Code) and `AGENTS.md` (a
  pointer to it, for Codex) but nothing for Cursor, while
  `docs/working-with-ai-agents.md` tells buyers to use Cursor. A fresh
  clone opened in Cursor started with no repository context at all.
  `.cursor/rules/fabrica.mdc` now ships in the tree — `alwaysApply`,
  and a pointer to `CLAUDE.md` rather than a second copy of it, so
  there is still one canonical file. No command to run: clone the
  repository and all three tools open oriented.

### Changed

- **`CLAUDE.md` covers what it was missing.** It is the file every
  agent ends up reading, and four things an agent gets wrong by
  writing the obvious code were not in it: the complete list of
  reserved `_domain/` directories (an agent that cannot see one puts
  buyer code in a factory file, and the buyer meets it as a conflict
  on the next upstream merge) together with the `(_domain)`
  route-group trap that makes a page silently unroutable; the money,
  jobs and account-lifecycle invariants — append-only credit ledger,
  webhook idempotency, Paddle-owned subscription state, reversible
  migrations, erasure as a code path; that generating the code is not
  finishing the task, and that a failing test is never deleted or
  skipped to reach green; and a pointer to `docs/upstream-updates.md`,
  which the file had never mentioned. Written as links into the
  existing docs, not as copies of them.
- `AGENTS.md` names the Cursor rule alongside itself, and both pointers
  are now held to that role by tests: `backend/tests/test_agent_context.py`
  asserts all three entry points ship, that the two pointers resolve
  and stay short, that `CLAUDE.md` still carries the `_domain/` map,
  the invariants, the verification expectations and the upstream
  guidance, and that every path any of the three cites exists.

### Removed

- **`CLAUDE.md` no longer carries our pull-request review policy.** The
  "Every PR goes through three review paths" section described how this
  repository asks Copilot for a review, how Codex is enabled, what an
  `@codex review` comment does, why a mention from `github-actions[bot]`
  does not work here, which secrets `claude-review.yml` needs, and what
  to do when a reviewer is unavailable. That is how the factory is
  maintained, not something a buyer building their own SaaS needs — and
  it shipped inside the file their coding agent reads first, alongside
  the architecture and the invariants. Removed in full; nothing replaces
  it. Where that detail is still needed it belongs in the workflow YAML
  or in maintainer docs, not in the buyer-facing agent guide.

  Everything a buyer's agent actually uses stays: the scaffold, the
  verification commands and "generating the code is not finishing the
  task", the load-bearing invariants, `_domain/`, the GDPR obligations,
  factory setup, and the upstream-update procedure.

### Notes

No schema change, no dependency change, no API change, and no runtime
behaviour change — upgrading is a merge of the tag. If you have edited
`CLAUDE.md` in your own repository, this release touches it, so expect a
merge conflict there and keep your own additions.

---

## [0.1.1] — 2026-09-08

Two buyer-path defects, both found by recording the 0.1.0 demo video. Each
only shows up once a browser drives a signed-in page, which neither the
test suite nor the from-scratch runs had ever done.

### Fixed

- **A first sign-in never reached an authenticated page.** Two faults in
  the same two lines. `.env.example` and `frontend/.env.example` sent Clerk
  to `/dashboard` after sign-in and `/welcome` after sign-up, and neither
  page has ever existed — the authenticated routes are `/account`,
  `/settings/billing` and `/admin/*`. Worse, the variable names themselves
  were inert: `@clerk/nextjs` 7 reads `*_FALLBACK_REDIRECT_URL`, so
  `AFTER_SIGN_IN_URL` was ignored and correcting its value alone changed
  nothing — the user simply landed on the marketing home instead of a 404.
  Both files now set `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` and
  its sign-up counterpart to `/account`, verified against a running app.
  `docs/architecture/overview.md` named the same dead route and was
  corrected.
- **Billing never loaded its pricing in local development.** The quickstart
  runs Next on `:3000` and FastAPI on `:8000` — two origins — while
  `CORS_ORIGINS` shipped empty, so the browser blocked every API call and
  the page sat on "Loading pricing…" indefinitely with no visible error.
  `.env.example` now ships `CORS_ORIGINS=http://localhost:3000`, and
  `docs/getting-started.md` documents both the setting and the symptom.

### Security

- `startup_guard` refuses to boot in production or staging while
  `CORS_ORIGINS` still contains a `localhost` or `127.0.0.1` origin. The
  shipped development value is a convenience for a laptop; this makes it
  impossible to deploy unedited, where it would let a local dev server make
  credentialed cross-origin calls to production.

### Notes

No schema change, no dependency change, no API change. Upgrading is a
merge of the tag. If your `.env` predates this release, add
`CORS_ORIGINS=http://localhost:3000` for local development and **replace**
the obsolete `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` /
`NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` variables with
`NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/account` and
`NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/account`. Repointing the
old names has no effect — Clerk 7 does not read them.

---

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `CHANGELOG.md`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two, which is what makes naming that version honest.

---
title: "What agent-driven work is bad at"
description: "The failure modes, in the order you meet them."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Extracted from The Fabrica v0.1.2.
     Edits belong in the product documentation, not here. -->

# What agent-driven work is bad at

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

The Fabrica is an ordinary Python + TypeScript codebase. You can work
in it the way you work in any repository. This guide is for people who
want to drive most of the work through an AI agent — Claude Code or
Cursor — and want to know what that actually looks like, including the
parts that go badly.

## Be honest about what this is

Agent-driven work is **not** no-code. It is code you did not type. You:

- Direct an agent in plain English (or Italian).
- Read the diffs it produces. You do not write them, but you do read them.
- Click through external service dashboards — Clerk, Paddle, Resend,
  your host, your DNS provider.
- Make the business decisions: pricing, copy, brand, scope.
- Verify. Always verify.

You do not learn to program this way. You do learn to **specify** what
you want precisely, and to tell a plausible-looking diff from a correct
one. The second skill is the one that decides whether this works for
you.

The honest prerequisite: you need to be comfortable opening a terminal
and reading an error message. Not writing code — reading. If that
sounds unpleasant, read [What this is bad at](#what-this-is-bad-at)
before committing to the approach.

## What this is bad at

In roughly the order you will meet them:

1. **Subtle bugs that pass the tests.** An agent writes code that looks
   right, passes what it wrote, and is wrong in a case nobody
   enumerated. You find out from a user. This is the main tax.
2. **Infrastructure that misbehaves.** When your host does something
   unexpected, the agent has no visibility into it and will guess. You
   end up in a support queue like everyone else.
3. **Changes that fight the codebase's patterns.** Ask for something
   the architecture doesn't accommodate and you get code that works but
   doesn't fit — and every later change to it costs more.
4. **Questions with no answer in the repository.** A security
   questionnaire, a customer's DPA redline, an auditor's request. The
   material in `docs/security/` and `docs/compliance/` gives you a
   starting point; it does not answer for you.

None of these are reasons not to work this way. They are reasons to
keep a developer you can call — for a review, an architectural
decision, or the week something is genuinely broken. Budget for that
before you need it.

## What you'll end up knowing

- How to specify a change precisely enough to be verifiable.
- Which parts of the tree are yours (`_domain/`) and which are the
  factory's.
- How to read a stack trace well enough to route it.
- How to check the database for what actually happened.
- How to deploy, and how to roll back.

And what you won't: how async Python works, why React server
components exist, how JWT verification is implemented. That is a fine
trade as long as you know you are making it.

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `docs/working-with-ai-agents.md`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two, which is what makes naming that version honest.

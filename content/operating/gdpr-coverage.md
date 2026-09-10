---
title: "GDPR coverage map"
description: "Article by article: what the code enforces, what a document carries, what is yours."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# GDPR coverage map

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `docs/recipes/gdpr-compliance-bundle.md`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

## What a questionnaire actually asks for

A real enterprise customer's GDPR/security questionnaire asks
~40-80 questions across 8-10 categories. Each category needs **both**:

1. **Running code** — something that demonstrably enforces the
   right at the SQL / API layer.
2. **Documentation** — a markdown / PDF describing the procedure,
   contact, retention, sub-processors, etc.

Most boilerplates ship #1 partially and skip #2 entirely. The factory
ships both.

## Coverage map

| GDPR Article | Code in factory | Document in factory | Buyer action required |
|--|--|--|--|
| **Art. 5(1)(c)** data minimisation | User model intentionally minimal (no name/phone/address) | RoPA §2.x lists every column collected | Audit your `_domain/` additions for over-collection |
| **Art. 7** consent | `marketing_consent_given` + HMAC unsubscribe + cookie banner 3-tier + Clerk sign-up-form capture | RoPA §2.4 + cookie banner copy | Update copy; optionally add a consent checkbox to your Clerk `<SignUp>` (writes `unsafe_metadata.marketing_consent`) |
| **Art. 13/14** info notices | Privacy page route (i18n) | `frontend/.../(marketing)/privacy/page.tsx` | Replace `{PROJECT_NAME}` placeholders |
| **Art. 15** right of access | `GET /me/export` | RoPA §2.x ties to endpoint | None — works as-is |
| **Art. 16** rectification | `PATCH /me/*` endpoints | RoPA reference | Document in your customer-facing privacy page |
| **Art. 17** right to erasure | `User.deleted_at` + `account_deletion` worker (30d grace + hard-delete) | RoPA §2.1 | None — works as-is |
| **Art. 20** data portability | `GET /me/export` returns User + Subs + CreditTx + AuditLog as JSON | RoPA §2.1 | Extend response if you add domain tables |
| **Art. 28** processor obligations | n/a (legal doc) | `docs/compliance/dpa-template.md` | Fill `{PLACEHOLDERS}`, lawyer review |
| **Art. 30** records of processing | Operational AuditLog table | `docs/compliance/ropa-register.md` | Add your domain rows |
| **Art. 32** security measures | All of `services/email.py` retry, `unsubscribe.py` HMAC, `middleware/security_headers.py`, TLS-required Redis, etc. | DPA Schedule 2 + threat model | Match Schedule 2 against your actual production posture |
| **Art. 33** breach notification | n/a (operational) | `docs/compliance/breach-notification-plan.md` | Fill role names + DPA URL for your jurisdiction |
| **Art. 35** DPIA | n/a (decision tool) | `docs/compliance/dpia-trigger-checklist.md` | Re-run when adding features that touch profiling / biometrics / minors / etc. |
| **Art. 44-46** transfers | Default deploy region `fra` (Frankfurt); sub-processor SCCs documented | DPA §8 + subprocessors page | Verify each sub-processor's SCCs are signed |

**Where the factory stands honestly**: the rows above are the ones the
shipped code and documents already answer. Everything outside them needs
buyer-specific decisions — jurisdiction, lawyer review, DPO appointment,
sub-processor choices — that code cannot make for you. How much of any
given questionnaire that covers depends entirely on the questionnaire, so
this page does not put a number on it.

## What this bundle DOESN'T cover

Be explicit with customers about what's NOT shipped:

- **SOC 2 Type II / ISO 27001**: certifications, not boilerplate
  artifacts. Budget €15-40k + 6 months for SOC 2 Type II via
  Drata / Vanta / Sprinto.
- **HIPAA / FINMA / PSD2 / etc.**: industry-specific compliance not
  covered.
- **DPO appointment**: required (Art. 37) if you do large-scale
  systematic monitoring or large-scale special-category processing.
  Most early-stage SaaS doesn't need one.
- **Privacy Shield successor**: as of 2026, EU-US Data Privacy
  Framework. Each sub-processor needs to be DPF-certified or have
  SCCs. The factory's subprocessors page documents which.
- **Cookie consent in non-EU jurisdictions** (California CPRA,
  Brazil LGPD, etc.): the 3-tier banner is GDPR-shaped. Other
  regions may need separate flows.

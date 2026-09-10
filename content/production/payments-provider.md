---
title: "Why Paddle, not Stripe"
description: "Merchant of record versus a tax bolt-on, for an EU seller."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica v0.1.2 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# Why Paddle, not Stripe

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

For European SaaS founders selling digital products, Paddle (Merchant
of Record) makes the EU VAT + tax compliance problem disappear.
Stripe does not. The factory's positioning is "AI SaaS boilerplate
for European Python founders" — Paddle is the right call.

## The competitor pattern

Most SaaS boilerplates (ShipFast, Open SaaS, Nextbase) default to
Stripe. They're built by US founders for US-leaning audiences. The
default makes sense in that market.

## Where Stripe breaks for EU founders

When you sell digital products to EU consumers (the typical AI SaaS
B2C / prosumer case):

1. **VAT MOSS registration**. EU's One-Stop-Shop mechanism requires
   you register for VAT in each country you sell to OR use the OSS
   portal. Stripe Tax can collect the right VAT rate per customer,
   but **you still have to file the OSS return quarterly**. Miss a
   threshold, miss a filing → audit + back-tax + penalties.
2. **Invoice format requirements**. Each EU country has minimum
   invoice fields (VAT registration number, customer's country, etc.).
   Stripe's invoice template is US-centric — buyers customising for
   EU compliance burn engineering time on something that has nothing
   to do with their product.
3. **Reverse-charge logic for B2B**. EU B2B sales between VAT-
   registered entities use reverse-charge — buyer pays VAT, seller
   doesn't. Stripe Tax handles this *if* you collect the customer's
   VAT number reliably + your accountant is comfortable. Mistakes
   here are not silently absorbed: tax authorities will recompute
   years of returns.
4. **VAT rate changes**. EU VAT rates change without much notice
   (UK shifted in 2023; multiple Eastern European tweaks since 2024).
   Stripe Tax updates these; you trust the configuration. With
   Paddle (Merchant of Record) the responsibility moves to Paddle's
   tax team.

The cost of bolting on a tax accountant + Stripe Tax + invoice
template work + quarterly OSS filings: easily €5-10k/yr of operating
overhead at $50k MRR. Stripe's 2.9% + €0.30 vs Paddle's 5% + €0.50
**looks** cheaper but the all-in is comparable, and you spend less
of your own time.

## What Paddle covers as MoR

- VAT collection + remittance to every EU country (and US sales tax,
  Australian GST, etc. — Paddle is the seller of record in 200+
  jurisdictions).
- Invoice generation in the customer's language + currency,
  compliant with each jurisdiction's format rules.
- Refund + chargeback handling. Paddle settles disputes; you don't
  argue with customer's bank.
- 1099-K equivalent for US tax filings (if any of your customers are
  US-based).
- Subscription state machine + dunning + retries on failed payments.

You wire a webhook handler, an API key, and a `priceId` per tier.
Three days of integration work + tax disappears.

## Where Stripe genuinely wins

- **Marketplace flows**. Stripe Connect lets you split payments
  between platform + sellers — Paddle doesn't have an equivalent. If
  you're building a marketplace (not a single-seller SaaS), Stripe
  is the right call.
- **US-only B2B SaaS**. If your customer base is 95% US and
  customers pay via wire / invoice / NetSuite integration, Stripe's
  ecosystem is richer.
- **Custom card-on-file flows**. Stripe's PaymentMethod abstractions
  + 3DS handling are best-in-class.

## What we ship + why it's portable

The factory's Paddle integration:
- `services/paddle.py` — HMAC webhook verify + checkout payload signing.
- `services/paddle_api.py` — REST API client (cancel + update price).
- `api/routers/billing.py` — webhook + checkout + subscription + downgrade.
- 7 webhook handlers (created / updated / activated / resumed / paused
  / past_due / canceled + transaction.completed).

The portability question: "what if I want to migrate to Stripe
later?". The factory's design helps:
- `Subscription` model uses generic columns (`paddle_subscription_id`
  → rename to `provider_subscription_id` for a multi-provider
  refactor).
- Webhook handlers are thin — port the dispatch + signature verify
  per-provider; the credit-ledger + audit-log integration stays.
- Migration recipe (`docs/migrations/payments-paddle-to-stripe.md`)
  is on the v0.2.0 roadmap. Documents the schema rename + the
  Stripe-equivalent webhook handlers + the VAT-compliance warning.

## The blunt summary

If you're in Europe selling AI/SaaS: pick Paddle. The fee delta is
swamped by the tax-compliance savings. If you're in the US selling
B2B with a custom finance stack: pick Stripe. Both are fine choices
for the wrong audience — the factory's audience is the first one.

## Receipts

- `backend/src/services/paddle.py`
- `backend/src/services/paddle_api.py`
- `backend/src/api/routers/billing.py`

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `docs/recipes/why-paddle-not-stripe.md`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two — the exporter refuses to name a product version otherwise.

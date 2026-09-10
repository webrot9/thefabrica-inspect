---
title: "Boot and runtime posture"
description: "Fail-fast guards, response headers, transport pinning and per-tier limits."
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica 1ee1bc9cb6619c19f57766731e7884b37f515dc9 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# Boot and runtime posture

> Extracted from The Fabrica at `main` (`1ee1bc9cb661`), from:
> - `docs/recipes/boot-guards.md`
> - `docs/recipes/security-headers-stack.md`
> - `docs/recipes/why-tls-cert-required.md`
> - `docs/recipes/why-llm-rate-limiting.md`

> **No release carries this yet.** It describes the documentation as it stands after `thefabrica-v0.1.2`, the most recent release.

## Fail-fast boot guards

The factory refuses to boot in production with sentinel secrets, an
unset DB URL, or `TESTING=1`. The API and the Celery worker + beat
processes all enforce the same invariants. If one fails, none boot.

### The competitor pattern

```python
# api/main.py
@app.on_event("startup")
async def init_things():
    log.info("API started")
```

Then when a buyer ships with `EMAIL_UNSUBSCRIBE_SECRET=""` to prod:
- The API boots. Routes register. Health check passes.
- First unsubscribe-token mint silently fails (or worse: returns an
  HMAC over an empty key).
- Operator finds out via support ticket or a Sentry spike, hours
  after deploy.

### What we ship

```python
# startup_guard.run_startup_checks()
def run_startup_checks(*, skip=()):
    for name, check in (
        ("project_config", _check_project_config),  # TBD sentinel → refuse
        ("secrets", _check_secrets),                # < 32 char → refuse; TESTING=1 → refuse
        ("cors_origins", _check_cors_origins),      # localhost origin in prod → refuse
        ("database", _check_database),              # SELECT 1
        ("redis", _check_redis),                    # PING
    ):
        if name in skip: continue
        check()  # raises StartupCheckFailure → process exits
```

Wired into **three** entrypoints:
- `api/main.py:lifespan` — FastAPI lifespan hook, runs once per worker process.
- `workers/celery_app.py:_guard_worker_boot` — Celery `worker_init` signal.
- `workers/celery_app.py:_guard_beat_boot` — Celery `beat_init` signal.

Symmetry matters. A misconfigured worker boots Celery, Celery
validates the broker (so the redis check is redundant — we skip it),
then starts pulling tasks. Without the guard, the worker silently
serves traffic with sentinel secrets.

### What each check protects

| Check | Bug it catches |
|-------|----------------|
| `project_config` | `COMPANY_LEGAL_NAME=TBD` — the factory shipped sentinel. Buyer didn't run `factory init`. Emails would render with literal "TBD" in the footer. |
| `secrets` | `EMAIL_UNSUBSCRIBE_SECRET` unset or < 32 chars → unsubscribe tokens forgeable. |
| `secrets` | `TESTING=1` in prod → `api/deps.py` auth bypass active → every endpoint unauthenticated. |
| `cors_origins` | `CORS_ORIGINS` still holds the `.env.example` `http://localhost:3000` in a deployed environment → a dev server on anyone's laptop can make credentialed cross-origin calls to production. |
| `database` | DB URL points to a host that's not reachable from the deploy region (firewall / wrong network). API would 500 every request. |
| `redis` | Redis URL points to dev Redis from prod. Celery broker, session cache, llm cache all fail silently. |

Each is a real bug The Fabrica encountered (or saw competitors
encounter) during the extraction.

### Test bypass

```python
class Settings:
    environment: Literal["development", "staging", "production", "test"] = "development"

def _check_secrets() -> None:
    if settings.environment in ("development", "test"):
        return
    ...
```

`ENVIRONMENT=test` skips secrets, project_config and cors_origins but
still runs DB + Redis. CI gets the integration safety without forcing
every test to set a 32-char dummy secret or a production origin list.

### Per-deploy override

A buyer can skip individual checks at runtime:

```python
run_startup_checks(skip={"redis"})  # worker_init does this — broker validates separately
```

Or environment-driven:

```python
SKIP_BOOT_CHECKS = os.getenv("SKIP_BOOT_CHECKS", "").split(",")
run_startup_checks(skip=set(filter(None, SKIP_BOOT_CHECKS)))
```

(Not shipped by default — buyers wire this only if they have a
specific reason. The default "all checks run" is the safe default.)

### Receipts

- Guard module: `backend/src/startup_guard.py`
- API wiring: `backend/src/api/main.py:lifespan`
- Worker wiring: `backend/src/workers/celery_app.py:_guard_worker_boot`

## The security headers stack

Every response from the factory backend ships with 6 security headers
even if the route handler returns 401 / 500 / random text. They cost
nothing per request, prevent whole classes of attacks, and break
nothing.

### The 6 headers

| Header | Value | What it blocks |
|--------|-------|----------------|
| `X-Content-Type-Options` | `nosniff` | Browsers MIME-sniffing JSON/JS as HTML → reflected XSS via response-content confusion. |
| `X-Frame-Options` | `DENY` | Embedding your site in an iframe → clickjacking. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Leaking the full URL (with query strings + tokens) when users click external links. |
| `Permissions-Policy` | `camera=()` etc. | Third-party widget loading code that asks for the user's camera/mic/geolocation. |
| `Content-Security-Policy` | `default-src 'self'; frame-ancestors 'none'; ...` | Inline script execution, third-party script loading, frame-busting, base-tag hijacking. |
| `Strict-Transport-Security` (prod only) | `max-age=31536000; includeSubDomains` | Downgrade attacks (HTTPS → HTTP via MITM). 1-year browser sticky. |

### What competitors ship

Most FastAPI boilerplates ship none of these. They add CORS, ship.
The headers above are added six months later, after the first
security audit / pentest report.

### What we ship

```python
# api/main.py
app.add_middleware(SecurityHeadersMiddleware)  # innermost
app.add_middleware(GZipMiddleware, minimum_size=1024)
if settings.trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)
if settings.cors_origins:
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, ...)
# outermost
```

Order matters. **Inside-out** middleware wrapping:
1. Handler runs.
2. SecurityHeadersMiddleware appends the 6 headers.
3. GZipMiddleware compresses (headers are intact).
4. TrustedHostMiddleware rejects mis-host requests (before handler, on
   request path).
5. CORSMiddleware emits preflight responses + injects ACAO header on
   normal responses (outermost so it sees even 401 / 500 responses).

### Why CORS is opt-in

The *field* default is off — `cors_origins: list[str] = []` — so nothing is
allowed unless a deployment says so.

`.env.example` is the one exception, and only for local work: it ships
`CORS_ORIGINS=http://localhost:3000`, because the quickstart runs Next on
:3000 and the API on :8000 and the browser cannot reach the API without it.
`startup_guard` refuses to boot in production or staging while a localhost
origin is still listed, so that convenience cannot reach a deployment.

The deployment topology matters:
- **Same-origin deploy** (API + frontend on `app.thefabrica.dev`): no
  CORS needed. Setting it would just emit headers that don't help.
- **Split deploy** (API on `api.thefabrica.dev`, frontend on
  `app.thefabrica.dev`): set `cors_origins=["https://app.thefabrica.dev"]`.

Shipping CORS on with `allow_origins=["*"]` as a default would be
*worse* than no CORS — it'd let any random page on the internet
issue authenticated requests if `allow_credentials=True` somehow
landed (which is invalid combination, but it's a common copy-paste
trap).

### Why CSP is restrictive by default

Default CSP:
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; ...
```

`'self'` only — no third-party scripts. `'unsafe-inline'` is allowed
for style because Tailwind's runtime CSS-in-JS would otherwise break.
`script-src` is strictly `'self'` (no inline script execution).

Buyers integrating:
- **Paddle.js**: add `script-src https://cdn.paddle.com` to the CSP.
- **Clerk frontend SDK**: add `script-src https://*.clerk.com`.
- **Sentry browser**: add `script-src https://*.sentry.io` + `connect-src`.

Each is a deliberate decision; the default refuses everything until
explicitly allowed.

### Why HSTS is production-only

HSTS tells the browser "always use HTTPS for this domain for the next
N seconds, no exceptions". In dev, you're on `http://localhost:8000`.
If HSTS fires there, the browser caches it + later denies you
`http://localhost:3000` for OTHER local projects.

`enable_hsts: bool = True` settings flag + production-only gate means:
- Prod (ENVIRONMENT=production): HSTS emitted, 1-year max-age,
  subdomain coverage.
- Dev/staging: HSTS not emitted.

Buyers who don't want HSTS in prod (rare — typically only relevant
for staging on the same domain as prod) flip the flag to False.

### What's NOT in this middleware

- **Rate limiting**: the factory's `middleware/llm_rate_limit.py`
  handles LLM-specific per-tier rate limits. General per-IP rate
  limits are a buyer choice (deploy environment matters — Cloudflare
  does this natively, Fly's L7 proxy doesn't).
- **CSRF tokens**: not relevant for JWT-bearer APIs. CSRF protects
  cookie-auth flows; we don't have any.
- **X-XSS-Protection**: deprecated by browsers. CSP supersedes it.

### Testing

```bash
curl -i https://api.thefabrica.dev/health | grep -E "^(X-|Content-Security|Strict|Referrer|Permissions)"
```

Should see all 6 headers. CI's `test_security_headers.py` covers the
positive cases — buyers adding routes don't need to think about this
again; the headers attach to every response automatically.

### Receipts

- Middleware: `backend/src/middleware/security_headers.py`
- Wiring: `backend/src/api/main.py:app.add_middleware(...)`
- Settings: `backend/src/config/settings.py:cors_origins,trusted_hosts,enable_hsts`
- Tests: `backend/tests/test_security_headers.py`

## Forcing CERT_REQUIRED on the broker URL

`backend/src/workers/celery_app.py:get_broker_url()` rewrites the
`rediss://` URL Celery uses for its broker + result backend to pin
`ssl_cert_reqs=CERT_REQUIRED`. The factory ships with
`redis_tls_verify=True` as the default.

### What competitors ship

```python
celery_app = Celery(
    "myapp",
    broker=settings.redis_url, # rediss://default:pwd@redis.upstash.io:6379
    backend=settings.redis_url,
)
```

If your `REDIS_URL` is `rediss://...` and you don't pass an explicit
`ssl_cert_reqs`, Celery historically defaulted to **`CERT_NONE`** —
TLS handshake completes but the certificate is *not validated*. A
network-level attacker (compromised wifi, malicious ISP, BGP hijack,
mistuned proxy) can present any cert and Celery will happily talk to
them.

### The blast radius

The Celery broker carries:
- **Task names + arguments** for every async dispatch in your app. With
  JSON serialization (we enforce this — see `celery-hardening.md`)
  that's PII passing in clear over the MITM path.
- **Task results.** Includes whatever your tasks return — credit
  amounts, user IDs, internal state.

The historical Celery default of `CERT_NONE` was a known footgun
(fixed in 5.x but plenty of older guides + tutorials still set it
explicitly). Upstash + Redis Cloud + AWS ElastiCache all serve TLS
on `rediss://`, but only if you *verify the cert* does that TLS mean
anything.

### What we ship

```python
def get_broker_url() -> str:
    url = settings.redis_url or "redis://localhost:6379/0"
    if not url.startswith("rediss://"):
        return url
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    params["ssl_cert_reqs"] = [_ssl_cert_reqs_token()] # CERT_REQUIRED by default
    if settings.redis_tls_verify and settings.redis_tls_ca_path:
        params["ssl_ca_certs"] = [settings.redis_tls_ca_path]
    return urlunparse(parsed._replace(query=urlencode(params, doseq=True)))
```

- **Strip + re-assert.** Whatever the env-supplied URL contains for
  `ssl_cert_reqs` is overridden. Defense-in-depth: a buyer's
  ops-team-set `REDIS_URL=rediss://...?ssl_cert_reqs=CERT_NONE` doesn't
  silently downgrade us.
- **Opt-out is explicit.** `REDIS_TLS_VERIFY=false` flips to
  `CERT_NONE`. For dev environments with self-signed certs, or
  internal Redis where you've already accepted network trust. Required
  to be deliberate.
- **Custom CA bundle**. `REDIS_TLS_CA_PATH=/etc/ssl/private/...` for
  internal CAs.

### Test plan

```bash
# Production setup — confirm cert validation
REDIS_URL=rediss://default:xxx@host:port/0 \
REDIS_TLS_VERIFY=true \
celery -A src.workers.celery_app worker --loglevel=info
# Boot should succeed; if cert is invalid, Celery refuses to connect.

# Local dev with plain redis — no TLS path triggered
REDIS_URL=redis://localhost:6379/0 \
celery -A src.workers.celery_app worker --loglevel=info
# No TLS, no override; works as expected.
```

### Receipts

- `backend/src/workers/celery_app.py:get_broker_url`
- `backend/src/config/settings.py:redis_tls_verify`

## Per-tier LLM rate limiting

The factory ships per-tier rate limits on every endpoint that calls
the LLM client. Free users get 10 requests/hour. Starter 60. Pro 300.
Enterprise unlimited. Without this, a single bad signup can burn $100
of Claude tokens before the credit ledger catches up.

### The competitor pattern

```python
@app.post("/generate")
async def generate(prompt: str, user: User):
    response = await openai.chat.completions.create(...)
    return response
```

No rate limit. Trust the credit ledger to charge per request. Works
in theory.

### Where it breaks

The credit ledger is **eventually consistent**:
1. User issues 100 parallel requests to `/generate`.
2. Each one reads `credits_remaining` (find 50 each), passes the
   check.
3. 100 LLM calls fire in parallel before the first row commits.
4. You pay for 100 calls at ~$0.03 each = $3 immediately, plus
   provider rate-limit overage charges if Claude / OpenAI throttle.

The factory's credit ledger makes the deduct atomic with a `FOR UPDATE`
row lock on the spending user — but the *expensive* part (the LLM call)
happens **before** the deduct lands. The lock prevents overspending
credits; it doesn't prevent burst-spending of vendor budget.

Real failure modes:
- **Stolen Clerk session** → 100 calls/sec for an hour → $100+ of
  tokens before you wake up.
- **Buggy frontend retry loop** → user's flaky network hits a 504,
  frontend retries 10× per second. Your $0.03 prompt costs $0.30 in
  retries.
- **Free-tier abuse** → bad actor signs up 50 emails, each making 10
  calls/sec. You pay before the credit ledger can refuse.

### What we ship

```python
# config/tiers.py
TIER_RATE_LIMITS: dict[SubscriptionTier, str] = {
    SubscriptionTier.FREE: "10/hour",
    SubscriptionTier.STARTER: "60/hour",
    SubscriptionTier.PRO: "300/hour",
    SubscriptionTier.ENTERPRISE: "0/hour",   # 0 = unlimited sentinel
}
```

Wired into the LLM router via the `rate_limited_llm` middleware:

```python
# middleware/llm_rate_limit.py
@rate_limited_llm
async def generate(...):
    ...
```

The decorator:
1. Reads `request.state.user.current_tier`.
2. Looks up `TIER_RATE_LIMITS[tier]`.
3. Applies the matching slowapi rule with a Redis-backed store.
4. On limit hit → 429 + `Retry-After` header.

Redis-backed so the limit holds across the worker fleet
(scaling `app=4` doesn't multiply the per-user budget by 4).

### The two-layer model

The factory uses both layers — they answer different questions:

| Layer | Question | Defends against |
|-------|----------|-----------------|
| Rate limit (this recipe) | "How many requests per hour can this tier issue?" | Burst spending; vendor cost spike; provider throttle. |
| Credit ledger | "Has this user paid for the cumulative usage?" | Total spend over the billing cycle; race-safe deduction. |

Rate limit is **operational** (per-second budget). Credit ledger is
**economic** (per-month budget). You need both: a free user with
10k credits in their pocket still can't burn them all in one minute.

### Why per-tier, not global

A global "10/hour" cap kills your enterprise tier's UX. A global
"300/hour" cap doesn't protect free-tier exposure. Per-tier is the
only answer that respects both ends of the customer spectrum.

The `"0/hour"` sentinel for ENTERPRISE is intentional: the
decorator short-circuits when it sees 0, no Redis call at all. Means
enterprise users pay zero latency overhead for the rate-limit
check, while still showing up in the same dispatcher (so the buyer
can change it later without code reshuffle).

### What you DON'T want to gate

Auth endpoints (sign-in, sign-up, webhook receivers) need their own
rate limits — at the IP level, not user level. That's a separate
recipe (`per-ip-auth-rate-limit.md`, planned for v0.2.0). Don't gate
auth endpoints with this LLM-rate-limit decorator; the semantics
are wrong (anonymous requests don't have a tier).

### Customisation

Buyers wanting different limits flip the values in `config/tiers.py`:

```python
TIER_RATE_LIMITS = {
    SubscriptionTier.FREE: "5/hour",      # tighter free tier
    SubscriptionTier.STARTER: "100/hour", # looser starter
    ...
}
```

Buyers wanting per-endpoint limits (e.g. "image generation costs 10×
more, so 1/hour for free") stack a second decorator. The middleware
is composable.

### Receipts

- Tier matrix: `backend/src/config/tiers.py:TIER_RATE_LIMITS`
- Middleware: `backend/src/middleware/llm_rate_limit.py`
- Example wiring: `backend/src/middleware/llm_rate_limit_example.py`
- Tests: `backend/tests/test_llm_rate_limit.py`
- Companion economic layer: see `docs/recipes/why-credit-ledger.md`

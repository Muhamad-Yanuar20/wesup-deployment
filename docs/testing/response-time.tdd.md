# Response time hotfix — TDD and validation

Date: 2026-10-01. Scope: user-approved local response-time hotfix. Landing markup,
design tokens, private PRD, transaction rules, database migrations, and unrelated
existing working-tree changes were preserved.

## Implementation

- Auth session previously verified the user and read profiles twice. It now
  explicitly shares one verified identity/profile with the access-state reader.
- getServerClient, getCurrentUser, and the viewer access reader use React cache
  only within a Server Component render. Route Handlers share their snapshot
  explicitly and read current account authorization per request. No persistent
  or cross-request authorization cache was introduced.
- Proxy uses Supabase getClaims (the configured project uses ES256), retaining
  cookie refresh, forwarded cookie headers, CSP nonce and server/API guards.
  SDK behavior for expired sessions/JWKS remains intact.
- Navigation accepts fresh server state without hydration or per-route GETs.
  After 60 seconds, the visible-tab timer/navigation/focus checks can refresh; concurrent
  checks share a promise. Login returns accessState and applies it before
  navigation. Logout verifies the resulting session. Network/service failures
  preserve the menu and return temporary unavailability; authoritative session
  401/403 clears it.
- Dashboard business profile, orders and notification count run in parallel
  after authentication.
- Marketplace uses one RLS-governed batches/timeline bulk read instead of
  per-offer get_offer_context RPCs. Capacity, unit, actual payment deadlines,
  payment policy and pickup schedule are retained. Full consent and capability
  context remains on the detail route.
- Supplier materialization completes before transaction snapshot and offer
  context are read in parallel. Lifecycle mutations, price locking, capability
  decisions, consent and invoice issuance remain server-owned.
- Product disclosure mounts its fetching form only on the first open.
- Shared GETs have an 8-second budget, independent response bodies, subscriber
  cancellation and a microtask grace period for Strict Mode reattachment.
  No completed responses are cached. Login/logout invalidate pending reads;
  resource/batch changes abort old subscribers and ignore stale results.
  Confirmed data remains visible when refresh times out or fails.
- Server-Timing and X-Request-ID cover auth/profile, search/enrichment,
  materialization/snapshot/context and proxy verification. Slow-request logs
  contain fixed route labels, request IDs and durations, not credentials or
  personal payloads.

Read budgets bound individual Supabase read promises and browser GET transport.
They do not retry requests. Mutating RPCs, login/logout POSTs, payment,
registration and invoice publication did not receive new mutation deadlines
or automatic retries. Materialization can outlive a browser read deadline;
subsequent guarded reads reconcile its server result.

Installed Next.js docs and Supabase SDK source were consulted for request
memoization, proxy, token verification and refresh behavior.

## Red → green evidence

Before implementation, newly added regressions observed:
- Session expected one user/profile read but received two.
- Auth transport failure expected 503 but received 401.
- Fresh snapshot expected zero hydration requests but received one.
- Concurrent session refresh expected one GET but received two.
- The GET read-budget/dedup helper did not exist.
- Search with 1/12 offers expected one search RPC; enrichment generated 2/13.

The first full integration run after initial implementation exposed 19 stale
contracts: automatic hydration expectations, network failure treated as logout,
and login fixtures missing the new access state/business profile query. Tests
now assert explicit refresh, authoritative 401/403, 503 preservation and direct
login-state synchronization. Role mismatch, inactive accounts, credentials,
suspension lifting and capability checks were retained.

Evidence: [first integration run](response-time/first-run.log),
[final unit suite](response-time/unit.log),
[final focused checks](response-time/final-related.log).

Additional coverage:
- 0/1/12 search results: zero bulk reads when empty, one otherwise; effective
  payment timestamps override planned timestamps; pickup schedule is unchanged.
- Singleflight GETs, independent bodies, Strict Mode subscriber handoff,
  account reset, cancellation, timeout without retry and stale resource changes.
- Fresh/aged navigation, focus, slow/failing sessions, login without extra GET,
  logout verification and late responses after logout.
- Last confirmed content retained after an 8-second hanging refresh.
- Claims without getUser, CSP/forwarded refresh cookies, transport failure
  without cookie erasure.
- Materialization before both parallel readers; disclosure stays unmounted
  until opened and retains its form after closing.
- Existing early-payment consent/capability, payment state and draft tests pass.

## Measurements

One warm-up then 20 sequential warm samples per endpoint/environment;
nearest-rank p95 is the 19th sorted observation. Values below are **p50 / p95 ms**
measured end to end, including the response body, using Playwright API context.

Disposable supplier/UMKM accounts and one private DRAFT without participants
were created solely for measurement and deleted in finally. No real offer was
published, closed, paid or invoiced. Marketplace used 5 existing public results;
12 items are a regression test, not a live load claim. Dashboard fixture has
no orders.

| Environment | Endpoint | Before | After |
|---|---|---:|---:|
| Development | session | 574 / 609 | 343 / 357 |
| Development | dashboard | 611 / 641 | 371 / 398 |
| Development | marketplace | 589 / 652 | 580 / 590 |
| Development | transactions | 580 / 627 | 461 / 493 |
| Development | proxy_page | 547 / 569 | 407 / 429 |
| Production lokal | session | 550 / 568 | 327 / 339 |
| Production lokal | dashboard | 590 / 702 | 355 / 371 |
| Production lokal | marketplace | 591 / 621 | 583 / 608 |
| Production lokal | transactions | 559 / 910 | 451 / 487 |
| Production lokal | proxy_page | 462 / 709 | 336 / 361 |

Warm proxy phase measured separately with 20 samples each:
development **5.5 ms p95**, production local **4.4 ms p95** (target ≤50 ms).
These measure token verification, not the complete HTML page. Concurrent browser
QA during this separate run produced development page totals up to 1.8 s while
proxy verification remained fast.

All main warm endpoint targets met in this sample: session p95 ≤500 ms;
dashboard/marketplace/transactions ≤1,000 ms; proxy verification ≤50 ms.

Raw observations: [before](response-time/before.json),
[after](response-time/after.json), [proxy](response-time/proxy-after.json).

Reproduce against a built baseline/hotfix and the existing dev server:

    node tests/performance/response-time.mjs before http://localhost:3000 http://localhost:3102
    node tests/performance/response-time.mjs after http://localhost:3000 http://localhost:3102

Set PERF_ONLY=proxy_page for the separate proxy sample. Scripts do not rebuild
or replace the user's dev server.

The original 36.9-second marketplace and 10.9-second session spikes were **not
reproduced**. Their exact cause is unproven. Read-only inspection measured warm
Supabase reads around 100–132 ms, cold reads 401–853 ms, Redis around 21 ms and
no blocked database session. Per-phase timing now identifies which stage grows
if a spike recurs. Healthy warm samples are not promises about remote-network
availability, cold starts, large participant batches or all production workloads.

## Verification

- Full non-live suite: **194 files, 1,477 tests passed**.
- Final focused deadline/capability/feedback/consent suite: **37 passed**.
- TypeScript: passed.
- ESLint: **0 errors, 200 warnings** across the existing codebase; no unrelated
  mass cleanup.
- Production build: passed, including the existing read-only transaction UX
  schema/RLS/grants/relationship readiness check.
- Desktop 1440px/mobile 390px: **10 Playwright tests passed**. Navigation stability,
  one active menu, no session GET before TTL, actual login with no follow-up GET,
  fresh/explicit draft recovery, aligned product fields, one transaction GET
  on mount, no closed product-detail GET, slow requests, keyboard dialogs,
  stale confirmation 409 and participant decision response-loss recovery.
  Browser transaction mutations were intercepted; temporary auth fixtures were
  cleaned up.
- Full live financial/invoice scenarios were not run against real participant
  data. No production migration/schema change is required or applied by this
  hotfix.
- User dev server on port 3000 was preserved; QA production server 3102 stopped
  after measurement.

Logs: [typecheck](response-time/typecheck.log), [lint](response-time/lint.log),
[build](response-time/build.log), [browser](response-time/browser.log).

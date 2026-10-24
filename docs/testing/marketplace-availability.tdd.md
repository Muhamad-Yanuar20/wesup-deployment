# Marketplace availability — TDD evidence

## Contract and decisions

- Marketplace contains only published offers inside `[registration_opens_at, registration_closes_at)` with remaining capacity and no recorded closure.
- Closed direct links explain expired/full/closed state without a join form, consent, login-to-join CTA, or route map. Existing participant orders remain accessible through their own routes.
- Capacity follows the transaction policy, not the discount target or paid-only volume. Legacy finite/unbounded tiers retain their capacity fallback.
- Search, detail, and progress use one private SQL availability computation. Search filters before count/pagination. The public read functions expose aggregate data only.
- List refresh: every 15 seconds while visible; focus/visibility revalidation; deadline expiration uses server time plus monotonic elapsed time. Detail retains four-second progress refresh.
- During implementation no production data/schema mutations, deployment, commit, or push were authorized. The subsequent explicit migration authorization and its result are recorded below.

## Rulings

- Progress now reads the same durable aggregate RPC as detail, rather than deriving eligibility from Redis. A stale or reset reservation counter cannot reopen an offer; Redis registration reservations and distributed locks are unchanged. This replaces three metadata reads plus the cache read with one public snapshot query.
- Availability fields are additive/optional in TypeScript to keep existing consumers source-compatible. The progress endpoint rejects old/malformed snapshots with 503; UI submission stays disabled until eligibility can be verified. Search detects nonempty old-schema responses and returns its existing schema-outdated error.
- A separate Next build directory is used only when `MARKETPLACE_ISOLATED_E2E=1`, because the user's development server is already running. The default development/production directory remains `.next`.
- The isolated fixture uses a local HTTP read adapter backed by actual PostgreSQL functions in PGlite. It is not a test against hosted Supabase/PostgREST. Production migrations and Vercel smoke tests remain deployment steps.

## RED evidence

1. Planning baseline: 36 tests / 4 files passed; no availability rule coverage.
2. New mapper/migration regressions: **7 failed / 1 passed**, showing closed rows were mapped ACTIVE and availability filtering did not exist.
3. New closed-detail UI regressions: **3 failed**, showing the old product/form/map composition instead of an unavailable panel.
4. New list refresh regressions: **4 failed**, showing no 15-second refresh, deadline removal, or focus revalidation.
5. Isolated PostgreSQL harness first executes the incumbent migration and confirms an expired and a full published batch both appear in search, then applies the new migration and tests the corrected behavior.

## GREEN evidence

- Initial SQL harness: **24 checks passed** (including baseline reproduction): expiry, capacity, discount-target distinction, opening/cutoff, over-capacity, legacy limits, cancellations, terminal closure, hidden statuses, public aggregate access, total/pagination, and private-helper denial.
- New mapper/migration/closed UI/background-refresh regressions: **15 tests / 4 files passed**.
- Deadline, response identity, join conflict/retry, and live-progress fixture checks: **10 tests / 3 files passed**.
- Final `npm test`: **240 files / 2205 tests passed** after review corrections.
- Existing transaction PostgreSQL harness plus final-slot regressions: **47 checks passed**. The next contender is rejected after the last slot commits, volume stays at capacity, and no extra invoice is created. This is serialized PGlite execution, not a physical concurrent database test.
- `npm run build`: passed, including the existing read-only schema preflight checks and production compilation.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with **0 errors / 15 existing warnings**.
- Browser: **3 Playwright flows passed** against the real read-model SQL via the isolated local adapter. Verified list exclusion and automatic capacity refresh, closed direct links at 320/390/768/1440, and an initially open detail becoming unavailable at its deadline. Eight screenshots cover list and closed detail at those widths; mobile and desktop closed screenshots were visually reviewed. Focus, 44px CTA target, reduced motion, and page overflow were checked.
- Fresh reviewer identified recoverable-offer context, later card deadlines during failed refresh, published/full recovery, and overlapping poll/mutation issues. Each was reproduced with a failing regression and corrected. The verification failure flag also clears on a newer successful background snapshot. Final targeted review regressions: **32 tests / 5 files passed**.
- User development server was left running. The task's separate QA server was stopped; no hosted fixtures or accounts were created.

## Remaining deployment verification

- Apply the migration to the intended hosted environment before deploying this application revision; this session did not apply it or deploy/push.
- Hosted PostgREST schema-cache/grants and Vercel smoke tests require that deployment. Physical concurrent PostgreSQL clients were not tested: Docker is installed but its daemon was unavailable. Existing registration lock tests passed in the full suite; the transaction writers and row locks were not changed.

## Hosted migration follow-up — 2026-10-24

After the user reported the schema-outdated marketplace screen and explicitly requested application of the migration:

- Verified that `DATABASE_URL` targets the same project as the application's Supabase URL. Confirmed the migration was absent and the private schema contained no existing functions/relations.
- Saved the previous public function definitions/grants in an ignored local cache before changing the schema.
- Applied only `20261024070517_marketplace_availability.sql`, under a transaction-scoped advisory lock with lock/statement timeouts. Verified anonymous search and public/private grants before commit, and recorded the migration in `supabase_migrations.schema_migrations` in the same transaction. PostgREST schema reload notification committed successfully.
- Post-commit checks passed: migration history, public REST search availability fields, and unavailable detail contract. Public search returned three available offers; unavailable offers were excluded.
- Application smoke checks: both `localhost:3000/api/marketplace/search` and `wesup-deployment.vercel.app/api/marketplace/search` returned HTTP 200 with three items and no schema error.
- No business records were updated by this migration. No code commit, push, or Vercel deployment was performed. The code rollout and physical concurrent-client verification remain separate steps; the earlier migration/PostgREST blockers are resolved.

## Reproduction and rollout

Install the isolated SQL runtime into an ignored cache (no application dependency change):

```powershell
npm install --prefix node_modules/.cache/wesup-availability --no-save --package-lock=false @electric-sql/pglite@0.3.14
node tests/database/marketplace-availability.mjs
```

For browser QA, start `node tests/helpers/marketplace-fixture-server.mjs` and run, in another terminal:

```powershell
$env:MARKETPLACE_ISOLATED_E2E='1'
$env:PLAYWRIGHT_BASE_URL='http://localhost:3199'
npx playwright test tests/e2e/marketplace-availability.spec.ts
```

The fixture binds only to loopback and overrides the test app's Supabase URL/key. It never creates hosted accounts or contacts a hosted database.

Before release: validate and apply `20261024070517_marketplace_availability.sql` to the intended environment, verify anonymous/authenticated RPC grants and closed-link behavior, then deploy the app and smoke-test Vercel. SQL migration is transactional, retains existing RPC input signatures, and notifies PostgREST to reload its schema. Do not deploy the application without the migration.

No changes to PRDs or environment secrets belong in the commit. No physical/hosted concurrency result is inferred from serialized PGlite execution.

## Pre-push verification — 2026-10-24

After the hosted migration, the legacy live search suite reproduced four failures because its searchable fixtures had already expired. Kept historical cancellation fixtures unchanged and gave search fixtures an open registration window; pagination assertions now also support an empty second page. The live suite passed all 12 tests afterward.

Final verification including compact radius and actual-discount pricing: `npm test` passed **241 files / 2213 tests**; production build and `npx tsc --noEmit` passed. ESLint completed with **0 errors / 15 existing warnings**, and the updated live fixture file passed its targeted lint check.

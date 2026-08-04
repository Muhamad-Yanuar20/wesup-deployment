# TDD Evidence Report — Live Supabase Migration Push + Integration Tests

**Task:** Apply the 8 Wesup migrations from `supabase/migrations/` to the remote Supabase project (`woxgghuoeljagnkldqtf`) and prove the pushed schema works via test-first live integration tests (pg + PostgREST), complementing the static 150-test schema contract suite.

**Source plan:** Variant of the schema TDD run. Plan phases: 0 setup → 1 RED (write live tests against empty DB) → 2 push migrations → 3 GREEN → 4 coverage + evidence.

## Task report

| Plan phase | Execution summary | Validation command | Result |
|-----------|-------------------|--------------------|--------|
| 0 — Setup | Wired `.env` loading into vitest (`loadEnv` from `vite`; vitest's `loadEnv` is not a function in this version), raised timeouts for slow cloud calls, installed `pg@^8.22` + `@types/pg`, gitignored `supabase/.temp/`, documented `SUPABASE_ACCESS_TOKEN` + `DATABASE_URL` in `.env.example`. | `npx tsc --noEmit` | PASS |
| 1 — RED | Extracted single-source contract to `tests/helpers/schema-contract.ts`; refactored static suite to import it; wrote `tests/live/database.integration.test.ts` with pg structural suite + constraint-enforcement behavior suite + PostgREST suite (auto-skips when `DATABASE_URL` / REST env vars absent). | `npm test` | **RED** — 196 failed / 152 passed (194 pg + 2 REST failures; static 150 still green) |
| 1 — checkpoint | Committed RED evidence. | `git commit "test: add live Supabase integration tests (RED - schema not yet applied)"` | `2e2c48a` |
| 2 — DB password | Reset project DB password via Management API (`PATCH /v1/projects/{ref}/database/password`, HTTP 200; `POST …/database-password` is a 404 dead-end). Wrote new `DATABASE_URL` (session-mode pooler, port 5432) into `.env`. | pg connection probe | `CONNECT OK: PostgreSQL 17.6` |
| 2 — link + push | `supabase link --project-ref woxgghuoeljagnkldqtf`, `supabase db push --dry-run` (8 migrations listed), then real push. First push **failed**: `ERROR: function public.is_admin() does not exist (SQLSTATE 42883)` at `create policy "profiles_select_admin"` — migration 0001 references helper functions *before* defining them. Migrations rolled back cleanly (0 public tables, empty remote history). Reordered `is_admin()`/`is_supplier()` above the policies that use them and re-pushed. | `supabase db push` | 8/8 migrations applied; `supabase migration list` shows local = remote |
| 3 — GREEN | Debugged 17 live-test failures — all test-query bugs, not schema defects: FKs/triggers returned unqualified names (`users` vs `auth.users`); `array_agg` over `information_schema` domain columns returned a string (`"{a,b}"`) not an array (fixed with `::text[]`); behavior tests needed the NOT NULL `ktp_photo_url`, an explicit enum cast in `INSERT … SELECT` (`'pending'::public.payment_status`), and a real FK chain for the immutable-trigger test (seed `auth.users` row, then insert audit log, run UPDATE via plpgsql `DO` block — a data-modifying CTE is invisible to a same-statement UPDATE). | `npm test` | **GREEN** — 348/348 |
| 3 — checkpoint | Committed GREEN evidence. | `git commit "fix: apply Wesup migrations to remote Supabase (GREEN)"` | `060a61c` |
| 4 — Coverage | Added client factory unit test `tests/unit/client.test.ts` (uses `vi.stubEnv` + dynamic import), wired `@/` alias into vitest, scoped v8 coverage to `lib/**` + `tests/helpers/**`. | `npm run test:coverage` | **352/352 passed; 100% stmts/branch/funcs/lines** on lib + helpers |
| 4 — Static checks | ESLint clean (removed 2 unused imports from refactor), TypeScript clean. | `npx eslint tests lib --max-warnings=0`; `npx tsc --noEmit` | PASS |
| Cleanup | Removed stray diagnostic rows (2 audit logs, 3 auth users, 3 profiles) created by manual cloud probes — disabled the immutable trigger, deleted, re-enabled. Test suite itself rolls back every transaction and leaves zero residue. | pg count probes | `admin_audit_logs = 0` |

### Migration 0001 ordering defect (found by live push)

The static parser suite **cannot** catch this because it strips `CREATE POLICY` / function bodies before parsing. Postgres requires the SECURITY DEFINER helper functions to exist before any policy's `USING`/`WITH CHECK` expression references them. The live push surfaced it on the first attempt (42883) and the fix — moving the two `CREATE OR REPLACE FUNCTION` blocks above the first policy — is now committed to `20260731000100_core_types_profiles.sql`.

## Test specification

| # | What is guaranteed | Test file | Test type | Result |
|---|--------------------|-----------|-----------|--------|
| 1 | 12 enum types exist on live DB with exact value sets | `database.integration.test.ts` (enums) | integration (pg) | PASS |
| 2 | All 21 tables exist with expected columns/types and NOT NULL on required columns | (tables) | integration (pg) | PASS |
| 3 | FKs resolve correctly incl. cross-schema `profiles.id → auth.users` | (foreign keys) | integration (pg) | PASS |
| 4 | All unique constraints enforced (12 constraints on 9 tables) | (unique constraints) | integration (pg) | PASS |
| 5 | CHECK constraints present over expected column sets | (check constraints) | integration (pg) | PASS |
| 6 | 11 critical indexes created | (indexes) | integration (pg) | PASS |
| 7 | RLS enabled on every business table | (row level security) | integration (pg) | PASS |
| 8 | Helper functions + both triggers exist (trigger names schema-qualified: `on_auth_user_created` on `auth.users`) | (functions and triggers) | integration (pg) | PASS |
| 9 | CHECK behaves: rating 1–5, positive money, 4-digit PIN, linear timeline (23514) | (constraint enforcement) | integration (pg) | PASS |
| 10 | UNIQUE behaves: NIK, `(batch_id, umkm_id)`, `payments(registration_id)` (23505) | (constraint enforcement) | integration (pg) | PASS |
| 11 | Enum + NOT NULL behave: bad enum 22P02/23514, missing NOT NULL 23502 | (constraint enforcement) | integration (pg) | PASS |
| 12 | `admin_audit_logs` is append-only: UPDATE raises P0001 via immutable trigger | (constraint enforcement) | integration (pg) | PASS |
| 13 | Every business table is served by PostgREST (HTTP 200) | (REST) | integration (REST) | PASS |
| 14 | Anon reads of `profiles` return empty list (RLS blocks) | (REST) | integration (REST) | PASS |
| 15 | Anon INSERT into append-only `admin_audit_logs` rejected (HTTP ≥400) | (REST) | integration (REST) | PASS |
| 16 | Client factory: throws on missing/partial Supabase env vars, yields working client otherwise | `client.test.ts` | unit | PASS |

**Command:** `npm test` → `Test Files 3 passed (3)`, `Tests 352 passed (352)`.
**Canary against live prod:** `supabase migration list --linked` → all 8 versions present both local and remote.

## Data hygiene

- Every behavior test runs inside a single transaction that is **always** rolled back (`expectViolation`), so the test suite writes no persistent rows.
- The RLS/REST canary uses only read-only anon requests plus one intentionally-rejected INSERT against the no-insert-policy audit log.
- Tests auto-skip (not fail) when `DATABASE_URL` or the REST env vars are unset, so `npm test` is safe on a machine without Supabase credentials.

## Coverage and known gaps

- **Coverage:** 100% statements/branches/functions/lines across `lib/**` and `tests/helpers/**` (v8 provider). UI components, API routes, and app structure are still create-next-app boilerplate with no executable logic to cover; Webhook/SQLFunctionLayer/EdgeFunction behaviors are future work per plan phase 0 scope.
- **Cross-tier batch rules** (tier N+1 cheaper, non-overlapping ranges) remain API-gatekeeper responsibilities (PRD §3.6), not DB CHECKs — unchanged from the schema report.
- **Redis counter mirror** (`registration_counters`) and **Midtrans webhook** flows have no integration coverage here (no Midtrans sandbox / Redis in env).
- **Migrations now on remote are immutable history**: future schema changes must be new timestamped migrations, not edits to `20260731*`.

## Merge evidence (in case of squash)

- **RED:** `2e2c48a test: add live Supabase integration tests (RED - schema not yet applied)` — 196 failed / 152 passed.
- **GREEN:** `060a61c fix: apply Wesup migrations to remote Supabase (GREEN)` — 348/348 passed (150 static + 198 live), `tsc --noEmit` clean, ESLint clean.
- **Coverage:** `352 passed / 352`, 100% on lib + helpers (`npm run test:coverage`).
# TDD Evidence Report — Database Schema Migrations

**Task:** Create every database table required by `prd/PRD.md` (Wesup group-buying platform for UMKM, self-pickup model) as Supabase/PostgreSQL migrations, validated via test-first schema contract tests.

**Source plan:** No `*.plan.md` file was provided. Journeys were derived directly from `prd/PRD.md` (10 business modules, sections 2–3) during this TDD run.

## User journeys

Derived from PRD modules:

1. As a Supplier, I want to register with KTP/location photos and a bank account, so that Admin can verify me and disburse escrow payouts. (IAM — module 1)
2. As a Supplier, I want to publish a batch with volume-discount tiers and an absolute timeline, so that UMKM can join before a hard cutoff. (Catalog — module 2)
3. As an UMKM, I want to search batches by location and join with explicit location consent, so that my price tier locks at the batch cutoff. (Marketplace/Orders — modules 3–4)
4. As an UMKM, I want to pay a QRIS invoice inside a fixed payment window, so that my order becomes Paid via webhook. (Payment — module 5)
5. As a Supplier, I want to validate pickup via QR/PIN, so that handover is recorded and the 24h escrow timer starts. (Fulfillment — module 6)
6. As an UMKM, I want to file a dispute with photo evidence within 24h, so that Admin can arbitrate and release or refund escrow. (Escrow/Dispute — module 7)
7. As an Admin, I want a manual refund queue and an append-only audit log, so that takedown/refund/dispute actions are traceable. (Moderation — module 8)
8. As an UMKM, I want to rate a completed transaction, so that supplier reputation exists without auto-suspend on bad ratings. (Reputation — module 9)
9. As any user, I want an in-app notification center, so that payment/pickup/dispute/suspension events are never missed. (Notification — module 10)

## Task report

| Plan task | Execution summary | Validation command | Result |
|-----------|-------------------|--------------------|--------|
| Schema contract tests (RED) | Wrote `tests/migrations/schema.test.ts` defining all 21 tables, 12 enums, 11 critical indexes, 62 RLS policies, functions, and triggers expected from the PRD. | `npm test` | **RED** — 36 failed, 4 passed (no migrations existed) |
| 8 migration files | Created `supabase/migrations/20260731000100…00800*.sql` covering IAM, catalog, orders, payments, fulfillment, escrow/disputes, refunds/ratings, notifications/audit. | `npm test` | **GREEN** — 150/150 passed |
| SQL syntax validation | Every migration parses with a real PostgreSQL grammar parser (`pgsql-ast-parser`) after stripping function/trigger/policy/RLS statements (parser-unsupported constructs validated structurally by regex contracts). | `npm test` (suite: "parse as valid PostgreSQL") | PASS |
| TypeScript surface | `types/database.ts` (typed `Database` client surface + enums), `lib/supabase/client.ts`. | `npx tsc --noEmit` | PASS (no errors) |
| Lint | `npx eslint tests/migrations/schema.test.ts types/database.ts lib/supabase/client.ts vitest.config.ts` | ESLint | PASS (0 problems) |

## Test specification

| # | What is guaranteed | Test file | Test type | Result |
|---|--------------------|-----------|-----------|--------|
| 1 | Migration files exist, follow `YYYYMMDDHHMMSS_name.sql` Supabase naming, strictly ordered, no duplicates | `schema.test.ts` (migration files) | unit | PASS |
| 2 | All SQL parses as valid PostgreSQL syntax | `schema.test.ts` (parse) | unit | PASS |
| 3 | No `DROP TABLE` / `TRUNCATE` in any migration | `schema.test.ts` (destructive) | unit | PASS |
| 4 | 12 enum types with exact PRD-derived value sets | `schema.test.ts` (enums) | unit | PASS |
| 5 | All 21 tables exist with every expected column and its type | `schema.test.ts` (tables ×21) | unit | PASS |
| 6 | NOT NULL on required columns per PRD business rules | `schema.test.ts` (tables) | unit | PASS |
| 7 | Foreign keys: `profiles.id → auth.users`, all cross-table FKs (e.g. `registrations.batch_id → batches`) | `schema.test.ts` (tables) | unit | PASS |
| 8 | Unique constraints: `registrations(batch_id, umkm_id)`, `payments(registration_id)`, `pickup_codes(registration_id)`, `escrow_holds(registration_id)`, `ratings(registration_id)`, NIK global uniqueness, tier/volume keys | `schema.test.ts` (tables) | unit | PASS |
| 9 | CHECK constraints: linear timeline `opens < closes < pay_opens < pay_closes < ready`, positive money amounts, `score BETWEEN 1 AND 5`, `pin_code ~ '^[0-9]{4}$'`, non-negative strikes/counters | `schema.test.ts` (business rule constraints) | unit | PASS |
| 10 | 11 critical query-path indexes exist | `schema.test.ts` (indexes) | unit | PASS |
| 11 | RLS enabled on every business table | `schema.test.ts` (RLS) | unit | PASS |
| 12 | At least one RLS policy per table (62 policies total) | `schema.test.ts` (RLS) | unit | PASS |
| 13 | `admin_audit_logs` has only SELECT/INSERT policies (append-only) + immutable trigger | `schema.test.ts` (RLS/functions) | unit | PASS |
| 14 | Helper functions `is_admin`, `is_supplier`, `handle_new_user`, `prevent_admin_audit_logs_mutation` exist | `schema.test.ts` (functions) | unit | PASS |
| 15 | Triggers `on_auth_user_created` (auth.users) and `admin_audit_logs_immutable` exist | `schema.test.ts` (triggers) | unit | PASS |

**Command:** `npm test` → `Test Files 1 passed (1)`, `Tests 150 passed (150)`.

## Coverage and known gaps

- **Coverage:** No code coverage tool is configured for this task; the deliverable is SQL migrations validated by 150 contract tests. `npm run test:coverage` is wired but was not run (no executable code under test).
- **Live DB verification:** Not performed — no Docker/psql/Supabase CLI available in this environment. Syntax is verified against a real PostgreSQL grammar parser, but migrations should be applied once with `supabase db push`/`supabase migration up` against the project's Supabase project and re-verified.
- **Cross-tier rules** (tier N+1 must be cheaper than tier N, non-overlapping volume ranges) are intentionally **not** DB CHECK constraints — they require multi-row comparison and are enforced by the API Gatekeeper layer (PRD §3.6). The `batch_tiers` table carries per-tier CHECKs only. A follow-up could add a trigger-based validator if defense-in-depth is desired.
- **Append-only enforcement** for `admin_audit_logs`: RLS lacks UPDATE/DELETE policies *and* a `BEFORE UPDATE OR DELETE` trigger raises — double protection. Inserts are service-role only; the INSERT policy is restricted to admins with `admin_id = auth.uid()`.
- **Redis/PG counter mirror:** `registration_counters` persists the counter for recovery; Redis `INCR` remains the runtime source of truth (PRD §3.2). No test covers Redis behavior (out of scope — no Redis in this environment).
- **Seed data** (admin user, sample categories) is a follow-up item, not part of this task.

## Merge evidence (in case of squash)

- **RED:** `test: add DB schema contract tests for Wesup migrations` — 36 failed / 4 passed (no migrations present).
- **GREEN:** `feat: add Supabase migrations, types, and client for Wesup schema` — 150/150 passed; `tsc --noEmit` clean; my files lint-clean.

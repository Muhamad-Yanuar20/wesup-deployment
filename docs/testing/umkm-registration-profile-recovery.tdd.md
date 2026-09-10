# UMKM Registration and Profile Recovery — TDD Evidence

Tanggal: 2026-09-10
Branch: marketplace

## Root cause

The application branch already contained the location-first signup RPC and own-row UMKM profile policies, but the connected Supabase MCP project was not the application's linked project. The target project is woxgghuoeljagnkldqtf; the available MCP project was iufasmxhdurtvrfswbyl and inactive. Remote schema drift therefore could not be verified in this session.

The failure path is now explicit: signup verifies the profiles and umkm_profiles rows after the RPC, and deletes the newly created auth user if either row is missing. The profile API returns stable error codes and logs a request ID without exposing database details to the browser.

## Tests added or updated

- Migration contract verifies RLS, grants, owner predicates, active UMKM checks, trigger role hardening, and service-role-only RPC execution.
- Signup service verifies both profile rows, detects a missing row, classifies cleanup failures, and preserves rollback behavior.
- Profile API verifies own-user upsert and stable profile_save_failed responses for RLS/database write failures.
- Onboarding component verifies that entered values remain visible and the error summary receives focus after a failed save.
- Schema contract includes the profiles.email column used by the auth trigger and duplicate-email lookup.

## Local verification

- Focused migration/API/signup tests: 25 passed.
- Focused service/API/onboarding/migration tests: 20 passed.
- TypeScript: npx tsc --noEmit passed.
- Existing warnings: Vite config-loader warning only; no test failure.

## Remote verification pending

The following must run after the Supabase MCP connection is switched to woxgghuoeljagnkldqtf and the project is active:

1. Read migration history and schema grants/policies.
2. Apply pending migrations in order, then the repair migration.
3. Run security advisors.
4. Create a disposable UMKM account and verify matching profiles and umkm_profiles rows.
5. Exercise profile insert/update with two UMKM accounts and verify RLS isolation.
6. Confirm no orphan UMKM profiles rows are created by failed signup attempts.

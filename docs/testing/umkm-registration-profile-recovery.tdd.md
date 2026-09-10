# UMKM Registration and Profile Recovery — TDD Evidence

Tanggal: 2026-09-10
Branch: marketplace

## Root cause

The application branch already contained the location-first signup RPC and own-row UMKM profile policies, but the target database had not received the pending migrations. The six pending migrations, including the idempotent recovery migration, were applied to the application project woxgghuoeljagnkldqtf and the local/remote migration histories now match.

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

## Remote verification

1. Applied six pending migrations to woxgghuoeljagnkldqtf, including the profile/RLS recovery migration; migration history is synchronized.
2. Live database and RLS suite: 239 passed.
3. Security advisor completed. It reports pre-existing warnings in legacy functions and Auth password protection; no new migration-specific failure blocked deployment.
4. The live suite verifies profile isolation, role hardening, and anon non-disclosure. Disposable signup/profile smoke tests remain available for the next deployment window.

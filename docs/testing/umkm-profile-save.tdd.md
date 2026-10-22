# TDD Evidence — UMKM Profile Save

Date: 2026-10-21 (Asia/Jakarta)
Branch: `codex/fix-umkm-profile-save`
PRD references: Identity & Access Management; Bandung business-location validation; platform-owned Hit-and-Run penalties.

## Defect and evidence

Completing a valid business profile returned HTTP 500 with `profile_save_failed`.
The deployed PostgreSQL logs showed SQLSTATE `42501` (`permission denied for table umkm_profiles`).
PostgREST's generated merge-upsert SQL included `user_id = EXCLUDED.user_id` in its UPDATE list.
The column-grant hardening migration correctly denies authenticated UPDATE on `user_id`,
`created_at`, `strike_count`, and `suspended_until`, allowing only business fields and `updated_at`.
Earlier unit tests assumed upsert success, and the earlier live grant regression used PATCH,
so neither covered this failing merge-upsert path.

## Implementation

`app/api/umkm/profile/route.ts` first updates only `business_name`, `address`,
`latitude`, `longitude`, and `updated_at`, filtered by the authenticated user's ID.
If that succeeds without a row, it inserts the same fields plus the session user ID.
An INSERT conflict (`23505`) triggers one owner-filtered UPDATE retry; other failures
and missing returned rows retain the existing HTTP 500 response and request ID.

The authenticated client, RLS, column grants, active-UMKM authorization, Bandung
validation, response shape, and onboarding UI remain in effect. No schema migration
or new privileged runtime client is needed. Work was kept on a dedicated local branch
in the existing checkout so the running development workspace receives the fix.

## RED — before changing production code

Added tests first in:

- `tests/unit/api-umkm-profile.test.ts`
- `tests/live/umkm-profile-save.integration.test.ts`

Command:

```text
npm test -- tests/unit/api-umkm-profile.test.ts tests/live/umkm-profile-save.integration.test.ts
```

Result: **12 failed, 9 passed** across two files.
Both live tests reproduced HTTP 500 / SQLSTATE `42501` through the real handler and
a signed-in publishable-key Supabase client. The live cases covered a registration
location-only row and a missing row with concurrent saves. The four positive unit
cases also returned 500; six failure-path assertions showed the intended bounded
UPDATE/INSERT flow was not used.

## GREEN — after the fix

```text
npm test -- tests/unit/api-umkm-profile.test.ts tests/live/umkm-profile-save.integration.test.ts tests/components/UmkmOnboardingForm.test.tsx tests/unit/umkm-profile-contract.test.ts tests/unit/umkm-profile-completion.test.ts tests/unit/api-registration-profile-gate.test.ts tests/migrations/umkm-profile-column-grants.test.ts tests/migrations/umkm-profile-rls.test.ts tests/migrations/umkm-registration-profile-recovery.test.ts
```

Result: **55 passed across 9 files**. The profile API unit suite contains 19 cases;
the new live suite contains two cases.

Coverage includes normalized and whitelisted writes, session-derived ownership,
existing and missing profiles, one conflict retry, UPDATE/INSERT errors, empty
responses, malformed JSON, invalid location, missing session, forbidden roles,
and every inactive account status. Existing onboarding validation and failure
feedback tests still pass.

The live suite verifies initial completion, a subsequent edit, GET readback of
business name/address/coordinates, and exactly one row after two concurrent saves.
Direct authenticated attempts to update `user_id`, reset `strike_count`, or set
`suspended_until` are denied with `42501`, and the stored penalty remains intact.
Only Next's cookie-client adapter is mocked; authentication and database operations
use the deployed Supabase service. Privileged access is confined to creating,
seeding, and deleting disposable fixture users in `finally`.

## Final verification

- `npm test`: **222 files passed; 2,052 tests passed** (65.19 seconds).
- `npm run lint`: **exit 0**, zero errors; 14 warnings in unchanged files.
- `npx tsc --noEmit`: **exit 0**.
- `git diff --check`: **passed**.
- Independent read-only review: **approved**, no actionable findings.
- Live cleanup audit: **0 remaining** `umkm-profile-save-*` fixture users.

The existing Vite configuration emits a warning about a future default config
loader; it did not prevent any tests from running. Windows sandbox restrictions
on temporary-cache renames required running the test commands with the approved
local process permissions. No dependencies or test configuration were changed.

Browser cookie integration and a deployed website were not exercised; this report
verifies the local handler against the configured live database. No deployment
was performed.

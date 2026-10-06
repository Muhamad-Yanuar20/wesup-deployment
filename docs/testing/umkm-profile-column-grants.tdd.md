# TDD Evidence Report — UMKM Profile Column Grants (Hit-and-Run Escalation Integrity)

Date: 2026-10-01
Migration: `supabase/migrations/20260920050000_umkm_profile_column_grants.sql`
PRD reference: Wesup PRD §2.2.3 (Hit-and-Run), §3.4 (escalation ladder)

## Source of the task

A read-only security audit of the Wesup codebase. The audit reconstructed the
effective RLS and privilege state across all 49 migrations and found one
exploitable issue, classified P0.

## User journeys

1. **UMKM edits their business profile.** An active UMKM opens their profile
   page and changes business name, address and location. The save must succeed
   and the values must persist.
2. **UMKM cannot erase their own penalty record.** An UMKM who has missed a
   payment must not be able to lower or clear the strike counter that the
   platform maintains against them.
3. **The platform can still apply penalties.** The lazy Hit-and-Run
   materialiser and the escalation ladder must still be able to increment
   `strike_count` and set `suspended_until`.

Journey 2 is the security property. Journeys 1 and 3 are the regression guards
that keep the fix from being a denial of service against the product or against
its own anti-abuse machinery.

## The defect

`public.umkm_profiles` was granted a blanket table-level privilege:

```sql
grant select, insert, update on table public.umkm_profiles to authenticated;
```

introduced in `20260909090000_umkm_profile_rls.sql:8` and repeated in
`20260910012225_umkm_registration_profile_recovery.sql:36`.

The accompanying RLS policies
(`umkm_profiles_recovery_select_own` / `_insert_own` / `_update_own`) filter
**rows**, not columns. `umkm_profiles_recovery_update_own` requires only
`auth.uid() = user_id` and `profiles.status = 'active'`. Those two conditions
restrict *which row* an UMKM may touch, and say nothing about *which columns*
inside it. Combined with the blanket grant, any active UMKM could reset the
penalty counter at will:

```js
await supabase.from("umkm_profiles").update({ strike_count: 0 }).eq("user_id", myId)
```

The whole escalation ladder in `apply_hit_and_run_escalation`
(`20260919000000_hit_and_run_escalation.sql:55,81,114`) keys off
`v_strike_count` read from that column. With the counter resettable, the ladder
(warning → 7-day suspension → permanent suspension) was a no-op against a
motivated client, and unpaid orders carried no financial consequence. The PRD's
core anti-abuse control for a group-buying platform with real supplier money was
client-defeatable.

Notably the hardening pattern already existed elsewhere in the same schema and
`umkm_profiles` was the last profile table to miss it:

| Table | Hardening | Migration |
| --- | --- | --- |
| `profiles` | `revoke update` + column grant | `20260805000000_auth_rls_hardening.sql:13-14` |
| `supplier_profiles` | `revoke insert, update` | `20260805000000_auth_rls_hardening.sql:16` |
| `umkm_bank_accounts` | owner SELECT only, no write policy | `20260918000000_bank_account_rls.sql:13-15` |
| `umkm_profiles` | blanket `select, insert, update` | **vulnerable** |

## Task report

### Task: write the migration

`supabase/migrations/20260920050000_umkm_profile_column_grants.sql`:

```sql
revoke update on public.umkm_profiles from authenticated;

grant update (business_name, address, latitude, longitude, updated_at)
  on public.umkm_profiles to authenticated;
```

The column list was derived by auditing every write path in the app:

| Column | Written by the app? | Verdict |
| --- | --- | --- |
| `business_name`, `address`, `latitude`, `longitude`, `updated_at` | yes — `app/api/umkm/profile/route.ts:133-145` | grant |
| `strike_count` | no — `SECURITY DEFINER` only | deny |
| `suspended_until` | no — `SECURITY DEFINER` only | deny |
| `user_id`, `created_at` | no (primary key / default) | deny |

`INSERT` was deliberately left intact. `app/api/umkm/profile/route.ts` uses
`upsert()`, which needs `INSERT` for the not-yet-created-row case, and `INSERT`
is not an escalation vector: the insert policy forces `user_id = auth.uid()`, so
the statement can only ever create the caller's own single row.

### Task: migration contract tests

`tests/migrations/umkm-profile-column-grants.test.ts` — 9 cases, two groups.

Group one pins the new migration: the revoke exists, the granted column set
equals exactly the five client-owned columns, and none of
`strike_count` / `suspended_until` / `user_id` / `created_at` is granted.

Group two is the anti-regression guard. It replays every migration in sorted
order and computes the *effective* final grant, failing if any later migration
re-introduces a blanket `grant select, insert, update on umkm_profiles`. This
catches the realistic future failure — someone repairing a signup bug and
helpfully re-adding the old blanket grant.

### Task: live enforcement tests

Six cases added to `tests/live/auth-rls.integration.test.ts` in a new
`UMKM penalty columns are server-owned` block, placed before the test that bans
the fixture user (role/status are mutated there, which would invalidate the
active-UMKM RLS predicates).

They run through PostgREST with a real signed-in session, so they exercise the
same path a browser would, not just SQL.

## RED/GREEN checkpoint evidence

The live tests were written first and run against the unmodified database.
Four of six failed, which is a live exploit proof rather than a theoretical
argument:

```
✓ allows the UMKM to edit its own business-profile columns      463ms
× blocks a UMKM from resetting its own strike_count              260ms
× blocks a UMKM from setting strike_count to a forged value      244ms
× blocks a UMKM from clearing its own suspended_until            248ms
× blocks a combined write that smuggles a penalty column         251ms
✓ keeps the penalty columns writable by the escalation path      332ms

Test Files  1 failed (1)
     Tests  4 failed | 15 passed (19)
```

The two controls passed even in RED, which is the important part of the
checkpoint: the legitimate profile editor worked, and the platform's own
`SECURITY DEFINER` write path worked. Only the four attack cases failed, so the
tests were isolating the vulnerability rather than the fixture.

The exploit was therefore confirmed end to end against the real database: a
freshly signed-up UMKM really could set `strike_count = 0`, forge it to `99`,
clear `suspended_until`, and smuggle `strike_count` into an otherwise legitimate
profile save.

Migration applied, then re-run:

```
✓ allows the UMKM to edit its own business-profile columns      427ms
✓ blocks a UMKM from resetting its own strike_count              634ms
✓ blocks a UMKM from setting strike_count to a forged value      403ms
✓ blocks a combined write that smuggles a penalty column      409ms
✓ keeps the penalty columns writable by the escalation path      337ms

Test Files  1 passed (1)
     Tests  19 passed (19)
```

### Privilege delta observed on the live database

Read from `information_schema.column_privileges` for grantee `authenticated`,
immediately before and after the migration:

`UPDATE` on `strike_count`, `suspended_until`, `user_id` and `created_at` was
present before and absent after. `UPDATE` on `business_name`, `address`,
`latitude`, `longitude` and `updated_at` is unchanged. `SELECT`, `INSERT` and
`REFERENCES` are unchanged.

## Test specification

`tests/live/auth-rls.integration.test.ts`

| # | Test | Asserts |
| --- | --- | --- |
| 1 | allows the UMKM to edit its own business-profile columns | PATCH of all five columns returns < 300 and the values persist |
| 2 | blocks a UMKM from resetting its own strike_count | seeded at 2, PATCH `{strike_count: 0}` returns >= 400 **and** stored value is still 2 |
| 3 | blocks a UMKM from setting strike_count to a forged value | PATCH `{strike_count: 99}` rejected **and** stored value still 0 |
| 4 | blocks a UMKM from clearing its own suspended_until | PATCH `{suspended_until: null}` rejected **and** stored instant unchanged |
| 5 | blocks a combined write that smuggles a penalty column | PATCH `{business_name, strike_count: 0}` rejected, and the legitimate column in the same payload does **not** land |
| 6 | keeps the penalty columns writable by the escalation path | table-owner `update ... set strike_count = strike_count + 1` still succeeds |

Test 5 covers a detail worth stating: PostgreSQL rejects the whole statement
when any column in the payload is ungranted, so an attacker cannot use a
legitimate-looking save to land a partial forgery.

In every attack case the assertion is on the **stored value**, not only the HTTP
status. This follows the existing convention in the bank-account tests in the
same file, where an RLS-filtered PATCH answers 204 and the meaningful check is
that the data is untouched.

`tests/migrations/umkm-profile-column-grants.test.ts`

| # | Test |
| --- | --- |
| 1 | revokes the blanket table-level UPDATE grant |
| 2 | grants UPDATE on exactly the business-profile columns |
| 3 | never grants a server-owned penalty column |
| 4 | documents the escalation bypass it closes |
| 5 | hardens a table whose only protection is a row-scoped policy |
| 6 | applies the hardening migration (sort order sanity check) |
| 7 | contains no blanket update grant for umkm_profiles |
| 8 | leaves the effective grant column-scoped |
| 9 | keeps INSERT so the profile upsert can still create a missing row |

## Coverage

- 9 migration contract tests, all passing
- 6 live enforcement tests, all passing
- Full suite: **175 files passed, 1 skipped; 1619 tests passed, 3 skipped, 1
  failed**
- `npm run lint`: 0 errors, 10 warnings, all pre-existing in files untouched by
  this change
- `npm run build`: succeeded
- `npx tsc --noEmit`: clean

## Test bugs found (not product bugs)

Two defects in the new tests, both caught and fixed during the work.

1. `umkm_profiles_recovery_update_own` was asserted against the hardening
   migration, but that file abbreviates the policy name in a comment. The
   assertion was moved to the recovery migration, which is also the more
   meaningful check: it confirms the row-scoped policy the bypass depended on
   actually exists.
2. `suspended_until` was compared as a raw string. PostgreSQL serialises
   `timestamptz` with a `+00:00` offset where `Date.prototype.toISOString()`
   emits `Z`. The security assertion had already passed; only the value
   comparison failed. Fixed by comparing `Date.parse` values.

## Known gaps

- **The `dispute_status` failure in the full suite is pre-existing and
  unrelated.** `tests/live/database.integration.test.ts:254` expects 3 enum
  values while the live database has 8 (`rejected`, `resolved_refund`,
  `resolved_payout`, `refund`, `payout` and others). Verified pre-existing by
  stashing all changes and re-running: the same assertion fails on a clean
  tree. It is schema-contract drift between `EXPECTED_ENUMS` in
  `tests/helpers/schema-contract.ts` and the applied migrations, and deserves
  its own task.
- **A Vitest fork-worker timeout in `tests/components/CreateCatalogForm.test.tsx`**
  appeared in one early run and did not reproduce in the final run. Flaky
  harness, not a code defect.
- **No defence in depth.** The fix depends on a privilege grant. A future
  migration that re-adds the blanket grant would reopen the hole; the group-two
  test in the migration suite is the guard, but a runtime trigger that rejects
  writes to `strike_count` / `suspended_until` from any non-definer path would
  be a stronger second layer. Not added here to keep the change minimal and
  reviewable.
- **`INSERT` remains table-level.** Judged safe (policy pins `user_id` to the
  caller, so it can only create the caller's own row) but it does mean a
  signup-path regression could insert a forged `strike_count`. Worth revisiting
  if signup ever accepts a client-supplied profile payload.
- **Finding 2 from the audit is still open:** 18 `SECURITY DEFINER` functions
  lack a pinned `search_path`. Not currently exploitable — every body was
  verified to fully qualify its objects and no migration grants `CREATE` on
  `schema public` — but it is a missing convention guard. Intentionally
  deferred to a separate change.

## Merge evidence

- `supabase/migrations/20260920050000_umkm_profile_column_grants.sql` (new)
- `tests/migrations/umkm-profile-column-grants.test.ts` (new)
- `tests/live/auth-rls.integration.test.ts` (modified — 6 tests, 3 helpers added)
- No application code changed; no route, component or service was touched.
- Migration is additive and idempotent at the privilege level: re-running it
  re-applies the same revoke/grant pair and reaches the same state.

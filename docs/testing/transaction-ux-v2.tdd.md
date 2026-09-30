# Transaction UX v2 — TDD evidence

Date: 2026-09-30. Scope: approved supplier/UMKM transaction UX and lifecycle plan.

This is the original pre-deployment report. The subsequent database deployment, real authenticated browser journeys, Midtrans sandbox settlement and outstanding live replacement-consent check are documented in [transaction recovery evidence](transaction-recovery.tdd.md).

## RED → GREEN

| Guarantee | RED evidence | GREEN target |
| --- | --- | --- |
| Fixed 24-hour schedule, WIB pickup and next action | `4ec56d4`; missing schedule/presentation modules | `tests/unit/transaction-ux-v2.test.ts`, `tests/migrations/transaction-ux-v2.test.ts` |
| Partial draft and four-step supplier form | `c347a09`; missing wizard | `tests/components/OfferWizard.test.tsx` |
| Last slot cannot overflow Redis | `e2151cb`; exactly-full counter returned negative zero | Registration-counter unit tests |
| Commercial lock comes from SQL | `7ea802c`; context not normalized | `tests/unit/offer-context.test.ts` |
| Accepted pickup periods differ per order | Per-order rights returned undefined | Offer-context unit tests and SQL harness |
| Lost registration response recovers the same order | `network lost`; Redis not resynchronized on thrown transport errors | `tests/unit/transaction-registration-v2.test.ts` (4 tests) |
| Unknown provider checkout does not cause another bill | Pending attempt became failed; duplicate creation returned 201 | `tests/unit/api-umkm-payment-snap.test.ts` (7 tests) |
| Every cutoff entry point respects v2 | Legacy cutoff did not reject early close | SQL harness and cutoff contract tests |
| Payment cancellation can be appealed once | SQL sweep used invalid enum `creating`, then lacked a cancellation reason | SQL harness |
| Partial emergency preserves completed handovers | SQL CASE returned text instead of enum | SQL harness |
| Late/repeated settlement queues one refund | `query has no destination for result data` in existing event logging | SQL harness plus payment-event migration |
| Suspended buyers can submit an appeal after logging out | Help login returned 403 for both suspension tiers | Login return-flow tests; transaction login guards remain covered |

## Verification

- Vitest final full suite excluding credential-dependent live tests: 173 files, 1,326 tests passed, including Snap uncertainty, draft recovery/copy and both suspended-account appeal regressions.
- PostgreSQL/WASM replay and lifecycle harness: all migration statements execute; 19 scenario messages pass, including partial draft, CAS, publication replay, full capacity, withdrawal/rejoin, locked promises, cutoff base-price fallback, explicit replacement, repeated lateness, appeal, early readiness, wrong/reused code, 24-hour escrow, partial emergency, no-show, uncertain provider, repeated late settlement, and authenticated draft RLS.
- Coverage of `schedule.ts`, `presentation.ts` and `offer-context.ts`: 98.76% statements, 91.79% branches, 100% functions, 100% lines. This is scoped coverage, not whole-project or all-UI coverage.
- Mobile Playwright: four v2 session/ownership guards at 390×844 passed. Existing supplier guest/login/API guard subset: eight passed. Authenticated staging journeys were not run.
- Typecheck and production build passed. Lint had zero errors and 198 existing warnings; warnings include user-provided skill scripts and existing image/test warnings.

## Reproduce the SQL runtime check

The isolated dependency avoids changing the user's existing package lock:

```powershell
npm install --prefix .codex/ux-v2-db --no-save --package-lock=false --ignore-scripts @electric-sql/pglite@0.5.8
node scripts/test-transaction-ux-sql.mjs
```

The harness stubs Supabase auth/storage surfaces locally, runs actual PL/pgSQL, and requires no credentials. `20260914000000_batch_pickup_name_audit.sql` is a historical remote-history mirror of earlier DDL and is explicitly skipped during replay. Fixture-only time travel temporarily disables timeline commitment and insert-window triggers, then restores them; production gates remain enabled. The final RLS scenario uses the actual authenticated SQL role. Third-party SQL parsing excludes function renames and DO blocks that its parser does not support; actual replay executes them.

## Limits and rollout

No remote Supabase migration, live provider transaction, bank transfer, authenticated staging journey, load/concurrency benchmark, or human usability study is claimed. Browser acceptance currently covers protected entry points; component and database tests cover the transaction contracts. See `docs/transaction-ux-v2.md` for staging and human acceptance tasks. PRD policy updates stay private and are excluded from commits. Automatic review rejected duplicate-SQL repair; the user explicitly approved it after backup, and the three complete suffixes were verified identical before retaining one copy.

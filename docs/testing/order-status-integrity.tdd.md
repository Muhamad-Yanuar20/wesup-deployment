# Order status integrity — 2 October 2026

## Incident evidence and scope

The incident was a top-level owner SQL statement without a WHERE clause:

```sql
UPDATE public.registrations
SET status = $1::registration_status, updated_at = NOW();
```

The earlier read-only investigation found one execution by `postgres`, 35 rows affected, and `pg_stat_statements.stats_since` at `2026-10-02T07:45:42.477Z`. The status audit contains 31 actual transitions to `cancelled` within `[2026-10-02T07:45:42Z, 2026-10-02T07:45:43Z)`: 14 paid, 6 refund_pending, 5 pending_payment, 4 no_show, 1 picked_up, and 1 registered. Four rows were already cancelled. The audit cannot identify the person/tool that issued the SQL. No evidence attributes this incident to Midtrans.

The manifest contains only those 31 audit event IDs and registration IDs. LEFT joins retain victims without invoices or timelines. It is not a search for all cancelled orders. See [manifest](order-status-integrity/incident-manifest.json).

## Red → green

| Regression | Red evidence | Green evidence |
|---|---|---|
| UPDATE without WHERE across all nine statuses | PostgreSQL fixture: `Missing expected rejection` before the new guard | Entire statement rejected; all original statuses identical afterward |
| Recovery classification | New unit suite initially failed to import the unimplemented classifier | Verified invoice/settlement/escrow, deadlines, changed rows, unknown attempts and already-paid order covered |
| Inconsistent cancellation feedback | 2 of 4 tests failed: returned ordinary cancellation/reconciliation codes | Structured `ORDER_STATUS_INCONSISTENT`; checkout remains blocked |
| Webhook versus reconciliation audit | 2 endpoint assertions failed, 14 existing tests passed | Server-authored source and request UUID supplied with unchanged RPC signature |
| Order list summary | 1 failed, 8 passed: showed final cancellation despite paid invoice | Inspection label/action and disabled payment capability |

The SQL test also caught a nullable boolean in the withdrawal exception; `coalesce(..., false)` now prevents a missing reason from bypassing the graph.

## Implemented safeguards

- New migration `20261002000200_order_status_integrity.sql`: BEFORE UPDATE graph guard for every role, including direct owner SQL; preserved deadline cancellation guard; paid/pickup/completed/no-show/refund states cannot become cancelled. Legacy registered→paid, withdrawal→rejoin and cancelled→refund_pending remain available.
- Removed UPDATE, DELETE, TRUNCATE, TRIGGER and REFERENCES table privileges from anon/authenticated/service_role; removed anonymous INSERT. Kept the authenticated legacy registration INSERT and RPC ownership checks. No public endpoint permits arbitrary status changes.
- Owner-only recovery ledger, RLS, explicit incident event authorization, exact microsecond timestamp comparison, unique incident/order identity, and atomic audit/restoration. Prepared authorization is rolled back with a failed transaction.
- Audit records old/new status, application actor, operation/RPC, request identity, session/request database roles, reason and incident identity. RPC names come from the stack without retaining SQL or arguments.
- New migration `20261002000300_payment_status_audit_context.sql`: payment RPCs consume the server audit envelope and strip it before storing provider payloads. Webhook/reconciliation sources are distinguishable; existing locks, payment validation, RPC signatures and transaction rules are retained.
- Operational read-only role has limited column grants and SELECT policies. It is NOLOGIN: provision a separate operator login/membership and set `DATABASE_READONLY_URL` through secret management. No login/password was created or printed. Database owner credentials remain appropriate only for migrations and controlled repair; an owner can intentionally disable triggers.
- Read-only consistency CLI detects cancelled paid invoices, escrow conflicts, unexplained premature cancellations and mismatched invoice/terminal financial state. No cron or automatic status repair.
- UI exposes inspection/reload/help rather than deriving payment permission from countdown. An inconsistent invoice has one main feedback card; normal checkout continuation remains available after a verified payable snapshot.

## Recovery execution and verification

Both migrations were applied atomically to the configured Supabase database and recorded in its migration ledger before recovery. The first dry-run classified **11 safe, 15 manual review, 4 reconciliation, 1 already resolved**. Only the explicit 11-ID list was executed, with a maximum of 11 rows.

Restored: **2 pending_payment** (including Demo 4 and the 227 kg order), **3 paid**, **4 no_show**, and **2 refund_pending**. This reinstates existing forfeiture/refund evidence; it does not create a penalty, transfer money or finalize a refund. The 111 kg order already paid by the user was skipped.

Recovery uses SERIALIZABLE, batch/registration/payment/escrow/refund/pickup/attempt row locks, live audit/manifest comparison and a fresh server clock before each write. It does not retry mutations. Exact PostgreSQL timestamp text avoids losing microseconds through JavaScript Dates.

Before/after comparison across all 31 rows confirmed identical quantities, final amounts, locked unit prices, effective payment/pickup deadlines, invoice states, escrow states/destinations and refund states. The second execution of the same 11 IDs returned `alreadyRestored` for every ID and produced no new status transition.

- [Dry-run](order-status-integrity/dry-run.json)
- [Committed before/after results](order-status-integrity/recovery-result.json)
- [Post-recovery classifications](order-status-integrity/after-recovery.json)
- [Idempotence verification](order-status-integrity/idempotency-result.json)
- [Consistency findings requiring review](order-status-integrity/consistency-after.json)

**19 cases remain deliberately unmodified**: 15 need manual review (missing/conflicting invoice evidence or elapsed next deadline), 4 need provider reconciliation. Do not infer settlement or change funds/penalties to make these records agree. Use transaction assistance and verify provider/escrow/refund/pickup evidence before any further approved repair. The consistency command exits 2 when business anomalies remain; that is not a clean bill of health.

## Validation

- Vitest unit/migration suite: **148 files, 1,239 tests passed**.
- Isolated PostgreSQL/PGlite guard suite: 7 groups passed (all-state atomic rejection, financial cancellation rejection, valid graph, rejoin/late refund, effective deadline/takedown, recovery authorization/rollback/idempotence, privileges/audit).
- Same guard assertions on configured Supabase PostgreSQL: 7 groups passed in a private fixture schema and rolled back completely. Public business rows were not used as test fixtures.
- Full migration replay/runtime fixture: 12 groups passed, including actual v1/v2 `finalize_payment`, webhook audit, atomic full-capacity invoice opening, fixed-cutoff preservation, withdrawal/rejoin, content locking, base-price cutoff, and cross-account RPC rejection.
- Actual Midtrans-event SQL fixture: 7 groups passed, including late failure after settlement, unresolved provider cancellation protection and audit-envelope stripping.
- Playwright: **4 tests passed** at 1440/390 px, 400–500 ms delayed responses, keyboard reload, disabled duplicate submission, no false callback success, no additional charge for inconsistent invoices, and no horizontal overflow. Disposable buyer was deleted. Order/provider responses were intercepted; no financial provider transaction was initiated.
- TypeScript passed; ESLint passed with **200 existing warnings, 0 errors**; production build passed with migration/privilege readiness precheck.
- [Inspection desktop](order-status-integrity/inspection-1440.png), [mobile](order-status-integrity/inspection-390.png), [recovered desktop](order-status-integrity/recovered-1440.png), [mobile](order-status-integrity/recovered-390.png).

The configured database has not been independently identified as a separate staging project. Remote fixtures were isolated and rolled back. Concurrent load testing of every provider race, a separate staging deployment, and completing another real checkout are not claimed. Existing payment endpoint regressions cover provider failures, access, idempotence, late results and recovery behavior. Landing, private PRD, pricing/payment policy, user configuration and pre-existing package-lock changes were not edited for this task.

## Operational commands

```powershell
node scripts/apply-order-integrity-migration.mjs
npm run db:check:order-integrity -- --schema-only
npm run db:check:order-integrity
npm run db:recover:order-integrity
# After reviewing the dry-run, provide exact IDs and an explicit row ceiling:
npm run db:recover:order-integrity -- --apply --ids=<reviewed-id-list> --max-rows=<count> --report=<local-report-path>
```

Apply the migrations before the application release. Build checks guard/privilege readiness; the full manual data check separately reports unresolved historical anomalies. Never use a table-wide update, extend deadlines automatically, bypass the guard, or restore orders outside the incident manifest. The old single-order recovery script is superseded by this manifest workflow and will not bypass the new guard.

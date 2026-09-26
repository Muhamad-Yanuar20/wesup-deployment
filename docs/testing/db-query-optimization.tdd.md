# TDD Evidence Report — Database Query Optimization

**Task:** Reduce network round trips, over-fetching, and repeated table scans across the Wesup read paths, without changing any API contract, lifecycle transition, RLS policy, or authorization decision.

**Source plan:** No `*.plan.md` file was persisted — the plan was produced in-session and approved by the user. Requirements trace to `prd/PRD.md` (API Gatekeeper, lazy evaluation, tier-price lock at cutoff) and the architectural rules recorded in `AGENTS.md`.

**Result:** 6 commits, `b254b47..9272fd2`, 27 files, +1948/−104. Full suite **1453 passed, 0 failed, 3 skipped**. `npx tsc --noEmit` clean. ESLint 0 errors.

## User journeys

The work is not user-facing. It exists so that the journeys below stay correct while getting cheaper:

1. As a UMKM, opening my orders list returns the same page shape whether 1 or 100 orders exist, and lifecycle state is reconciled without N round trips.
2. As a UMKM, registering for a batch either succeeds or fails with the exact documented reason, and the gate is read in one query.
3. As a supplier, opening the transaction screen sees identical capabilities, summary, and order rows to before.
4. As a supplier, my escrow and payout balances read the same numbers, including when I have no ledger activity at all.
5. As a supplier or admin, finding a batch by text, category, or distance returns the same ordering, distances, and `total_count`.

## Task report

| Plan task | Execution summary | Validation command | Result |
|-----------|-------------------|--------------------|--------|
| Read-path indexes | `20260920000000_query_indexes.sql` — 12 indexes across `batches`, `registrations`, `payments`, `refund_requests`, `notifications`, `admin_audit_logs`, `supplier_ledger_entries`. Chose plain indexes, not `INCLUDE`, because `tests/migrations/schema.test.ts` does not parse `INCLUDE`. | applied to live DB; `docs/database-schema.md` updated | PASS — live index count 81 → 93 |
| Stop over-fetching | Narrowed `ORDER_SELECT` (list) vs `DETAIL_SELECT`, removed `pickup_code` and `payment_attempts` from list reads, trimmed dashboard and audit-log projections, moved progress to Redis-first with a restricted `sum_registered_quantity` RPC fallback. | `npx vitest run tests/unit/order-list-select.test.ts` + full suite | **GREEN** (`bc20335`) |
| Registration gate single read | `app/api/registrations/route.ts` embeds timeline and tiers in one `batches` query via `batch_timeline(...)` / `batch_tiers(...)`. | 2 new missing-branch tests + query-shape assertions; fakes throw on any separate table read | **RED→GREEN** — DB reads 3 → 1 (`4b6675b`) |
| Batched lazy reconciliation | `materialize_umkm_orders(p_registration_ids uuid[])` sweeps distinct batches once and isolates per-registration failures. Route makes one RPC + one refresh read. | `tests/unit/api-umkm-orders-round-trips.test.ts` guardrail; live test proved unsigned call rejected, `[]` → 0, 5 IDs in one call | **GREEN** — round trips N → 1 (`8c95515`) |
| Supplier finance single pass | `get_supplier_finance` read `supplier_ledger_entries` four times for four totals; one grouped pass with aggregate `FILTER` replaces it. | live test asserts agreement with an independently written aggregate; before/after capture on a supplier with real ledger rows | **GREEN** — byte-identical (`2de751f`) |
| Batch transaction read model | `get_supplier_batch_transaction` scanned `registrations` 9× and `batches` 13× (10 were scalar subqueries re-reading columns already selected). One grouped registration pass + one joined batch read. | 14 live characterization tests + before/after byte capture | **GREEN** — scans 11.6→3.6 and 14.3→2.05 (`9272fd2`) |
| `search_batches` lateral | Investigated hoisting the tier aggregation past the exact-distance filter. | `EXPLAIN (ANALYZE, BUFFERS)` on live DB | **NOT DONE — evidence did not support it** (below) |

## Test specification

Three of the six changes touch money or authorization, so the rule applied throughout was: characterize the original behaviour first, prove the new behaviour is identical, and never let a refactor be the thing that defines the contract.

**`tests/live/supplier-finance-scans.integration.test.ts`** (4 tests) — the function agrees with an independently written grouped aggregate; the four balance keys are exact; the zero-ledger case still reads `0`, not `null`; the response shape is unchanged. Passes against both the old and new function body.

**`tests/live/supplier-batch-transaction.integration.test.ts`** (14 tests) — written and run green against the **original** body before anything was rewritten, then run again against the consolidated body. Covers every capability branch (`canEditCommercialFields`, `canCloseBatch`, `canCancelBatch`, `canMarkReady`, `canConfirmPickup`, `canViewDispute`, `canRequestPayout`), all nine registration statuses, the admin reconciliation path, non-owner denial (`batch access denied`), missing batch (`batch not found`), and the ten scalars duplicated at the top level.

**`tests/migrations/batch-transaction-scans.test.ts`** (12 tests) and **`tests/migrations/supplier-finance-scans.test.ts`** (6 tests) — assert the consolidated shape and, more importantly, pin the traps: `coalesce` on every grouped total, the exact summary bucket groupings, the authorization error messages and `errcode`s, signature/volatility/`search_path`/grants, and additive-only.

## Edge cases found and pinned

These are the cases a "safe" consolidation would have broken silently. Each is now a test.

1. **`canEditCommercialFields` must not use `participant_count`.** The old check was `not exists (select 1 from registrations …)`, which counts *every* row. `participant_count` excludes `cancelled`. A batch whose only registration was cancelled has `participant_count = 0`, so deriving the flag from it would have handed that supplier write access to commercial fields. The gate is on `registration_count`, and `tests/live/…` asserts the cancelled-only batch still refuses editing.

2. **A `GROUP BY` yields no row for an empty batch.** The old body used bare aggregates, which always return exactly one row, so a batch with no registrations still got all six summary keys and `totalQuantity: 0`. The grouped form returns nothing, so every consumer coalesces to zero and the summary keeps all six keys instead of collapsing to `{}`.

3. **`sum()` over a fully-filtered set is `NULL`, not `0`.** For a batch whose only registration was cancelled, `registered_quantity` and `total_amount` must read `0`, not `null`.

4. **A timeline-less batch must get an empty capability object.** The old body built capabilities from an *inner* join on `batch_timeline` while the batch document used a *left* join. Consolidating to a single left join would have silently started granting flags, so the behaviour is reproduced with an explicit `case when t.batch_id is null`.

5. **`bool_or` returns `NULL`, not `false`, for no rows.** The `exists` predicates it replaces needed `coalesce(…, false)` so `not exists` stayed `true`.

## Measured effect

Live database, 20 calls per scenario, deltas from `pg_stat_all_tables`:

| Read path | Before | After |
|---|---|---|
| `registrations` scans per `get_supplier_batch_transaction` call | 11.6 | 3.6 |
| `batches` scans per `get_supplier_batch_transaction` call | 14.3 | 2.05 |
| `supplier_ledger_entries` scans per `get_supplier_finance` call | 4 | 1 |
| Registration happy-path DB reads | 3 | 1 |
| Order-list lifecycle round trips | N | 1 |

## `search_batches`: investigated, deliberately not changed

The plan proposed hoisting the lateral tier aggregation past the exact-distance filter, so tiers would only be aggregated for rows that survive. Measured first:

```
published batches in database: 7      batch_tiers rows: 17
EXPLAIN (ANALYZE, BUFFERS) search_batches(p_lat => -6.914744, p_lng => 107.60981, p_radius_km => 5)
  Function Scan on search_batches (actual time=3.476..3.477 rows=1 loops=1)
    Buffers: shared hit=18
  Execution Time: 3.508 ms
```

18 buffer hits and 3.5 ms for the whole call. The lateral is already one index lookup per candidate row, and the function already applies a bounding-box pre-filter before the exact haversine. At MVP scale (Bandung-only, single-digit published batches) there is no repeated-scan problem to fix, and a third CTE would add complexity to a `security invoker` read-only function for a hypothetical win that does not appear. The five existing live search tests remain the safety net if this is revisited at scale.

## Live fixture isolation

The live suite shares one database. This work added a test that creates *published* batches, which collided with `tests/live/cancellation-search.integration.test.ts`: that test pages published batches inside a 5 km radius of downtown Bandung and asserts exact ordering, so foreign fixtures crowded out its results. Two fixes, both on the new test's side:

- Fixtures are parked at `-7.351234, 108.152345`, far outside that radius, and use titles/categories that cannot match the other suite's text and category filters.
- Teardown deletes in foreign-key order and **reports** failures instead of swallowing them. The original teardown used `.catch(() => undefined)`, which silently leaked 44 batches and 52 users into the shared database and caused the failure above. A swallowed `LIKE 'NIK-Txn-%-'` pattern (the NIK ends with a run token, so the trailing hyphen never matched) left disputes behind, which then blocked every subsequent delete.

## Rejected approaches

- **Aggregating orders/counts into the order-list query.** Would have meant paginating in the database and lost the global `counts`/`summary` contract. Deferred; if attempted it needs its own regression tests first.
- **Caching hot reads in Redis.** The project deliberately avoids cron and stale derived state; a cache would introduce an invalidation surface larger than the read it saved.
- **A generic `INCLUDE` covering-index pass.** `tests/migrations/schema.test.ts` does not parse `INCLUDE`, and the covering benefit was unmeasured.

## Files

| Commit | Migration | Tests |
|---|---|---|
| `cfcb262` | `20260920000000_query_indexes.sql` | index contract entries |
| `bc20335` | `20260920010000_query_aggregates.sql` | `tests/unit/order-list-select.test.ts` |
| `4b6675b` | — | `tests/unit/api-registrations.test.ts` |
| `8c95515` | `20260920020000_batched_order_materialization.sql` | `tests/unit/api-umkm-orders-round-trips.test.ts`, schema contract, `types/database.ts` |
| `2de751f` | `20260920030000_consolidate_supplier_finance_scans.sql` | `tests/live/supplier-finance-scans.integration.test.ts`, `tests/migrations/supplier-finance-scans.test.ts` |
| `9272fd2` | `20260920040000_consolidate_batch_transaction_scans.sql` | `tests/live/supplier-batch-transaction.integration.test.ts`, `tests/migrations/batch-transaction-scans.test.ts` |

## Known gaps

- `get_supplier_batch_transaction` is refactored and live-verified, but the admin **write** routes that consume its capability flags were not re-tested against the new body; they are covered only through the function's own tests.
- Migrations were applied with Node `pg` in explicit transactions (`ssl.rejectUnauthorized: false`) because neither the `supabase` CLI nor `psql` is available here. Whether `supabase_migrations.schema_migrations` recorded all of them is **unverified**.
- The global order-list `counts`/`summary` contract is now covered by `tests/unit/api-umkm-orders-global-counts.test.ts` (10 tests), added after the fact and verified to fail if `counts` is derived from the filtered set rather than every order.
- Notification reads are indexed but still unbounded; pagination there is an API-contract decision, out of scope here.

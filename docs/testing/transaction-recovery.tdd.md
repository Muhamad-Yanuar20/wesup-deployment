# Recovery of Pesanan — live implementation evidence

Date: 30 September 2026. Target: `http://localhost:3000`, Supabase project `woxgghuoeljagnkldqtf`. This report follows the user-approved recovery plan. All browser API calls used the running application and actual Supabase; no API interception or mock provider was used.

## Result and remaining acceptance

The authenticated order list and canonical order detail now load and survive refresh. Supplier draft, publication, buyer join/withdraw/rejoin, readiness, PIN handover, QRIS sandbox settlement, callback replay and expired supplier-lateness refund have been exercised against persisted QA records.

**The complete browser acceptance matrix is not finished.** Explicit acceptance of a replacement pickup period *before the agreed period expires* was verified in the isolated PostgreSQL runtime harness, but was not exercised through the live browser in this session. By that stage the actual clock had passed 22:00 WIB; a valid v2 pickup period could no longer be active. Active database triggers and the database clock were not altered to manufacture a passing result. Human usability testing and real bank transfers are also outside this proof.

The payment and pickup stages use separate, clearly named QA fixtures, as authorized in the plan. The published offer was created through the actual four-step form; its future cutoff was retained. This report does not claim a single immediate journey from publication to pickup across several days of fixed windows.

## RED → GREEN checkpoints

| Guarantee | Failing checkpoint and observed failure | Implementation and successful proof |
| --- | --- | --- |
| Existing orders remain readable with the old schema | `7ea055c`: v2 graph failed on absent `pickup_replacements`; legacy read failed instead of loading orders | `dfd6053`: narrowly retry the legacy projection for missing v2 objects, retain ownership filters, propagate unrelated errors |
| Preserve the deployed late-payment refund fix | `7ea055c`: local function restricted eligible registration statuses to `cancelled` | `dfd6053`: retain `registered`, `pending_payment`, `cancelled`, `paid` when the batch is cancelled |
| Detect schema mismatch before deploying new UI | `c05f7d9`: readiness module absent; live catalog check reported missing columns/tables/functions | Prebuild check now verifies actual catalog, RLS, grants and PostgREST relationships; the active project passes |
| Generate pickup credentials on real Supabase | `6fd7f09`: authenticated `generate_pickup_code` failed with `42883`, missing `gen_random_bytes(integer)` | Schema-qualified pgcrypto migration deployed; actual authenticated SQL test passes and browser PIN handover succeeds |
| Preserve RPC binding and the product unit | `23b0938`: detached `rpc` lost its receiver; pickup API defaulted kg orders to pcs | Bound client call and offer-context unit; supplier Ready POST 200 and handover displays 1 kg |
| Checkout works on canonical order detail | `5cfb053`: canonical route lacked Midtrans CSP allowance; recovery marker was cleared and reload continued | Canonical route allowance added; recovery remains limited to one per order/session; actual checkout POST 201, QRIS settlement and reconciliation 200 |

The GREEN implementation checkpoint `3e589d9` contains the remaining fixes; RED commits are preserved on the active branch. Additional regression checks exercise the real SQL migrations instead of relying on the SQL AST parser for unsupported DO/NOTIFY statements. The live pickup regression creates a fresh rollback-only fixture, so it does not expire with the browser QA order.

## Database deployment

Before DDL, a repeatable-read snapshot captured all 29 public tables, 22 existing registrations, SQL function definitions, columns, constraints, triggers, indexes, RLS policies, grants and migration history. The private JSON backup was read back and SHA-256 verified. It is a public-schema/data snapshot, not a full `pg_dump` of Auth/Storage binaries. Its contents and credentials are excluded from Git.

The ordered migration set was first executed in a transaction and rolled back. Existing order status, quantity, final amount, locked tier and promised batch dates were compared before/after. The approved application then committed the same migration set and recorded its history. A further verified backup preceded the pickup crypto correction. No database reset, user deletion, active clock override or production trigger disable was performed.

Applied missing versions:

- `20260919000000`, `20260919003000`, `20260919004000`, `20260919005000` — escalation, reconciliation and complaint handling.
- `20260920000000`, `20260920010000`, `20260920020000`, `20260920030000`, `20260920040000` — indexes and bounded transaction reads.
- `20260930000000`, `20260930010000` — transaction UX v2 and payment-event execution, preserving the remote refund status superset.
- `20260930141347` — Data API grants with owner RLS retained.
- `20260930143938` — schema-qualified pickup crypto.

The authenticated QA buyer cannot see supplier drafts; the anonymous SQL role sees zero drafts. Supplier access to the buyer-only order API returns 403. Supabase's default anonymous SELECT grant exists on these tables; row access remains denied by RLS. Publication uploaded its product photo through the actual Storage path. The active database's 33 relations, 118 functions and 12 enums generated `types/database.generated.ts`; TypeScript now uses that schema contract. Management API access to this project was unavailable, so generation used the verified read-only PostgreSQL catalog connection.

## Browser and database correlation

Screenshots use a mobile viewport of 390 × 844. Only dedicated QA accounts and QA business data were used. Pickup secrets and payment QR images are masked; passwords, session cookies, Snap tokens and server keys are not included in public evidence.

| Journey | Persisted identities / API result | Evidence |
| --- | --- | --- |
| Partial supplier draft, refresh, publication | Draft `bafb5356-6ebd-4ad2-ba4c-1ba117df88d2`; batch `64ae5fb3-b504-4ea0-bd06-8ddc751ecb72`; save/publish 200 | [Draft restored](evidence/transaction-recovery/06-draft-restored.png), [review](evidence/transaction-recovery/07-offer-review.png), [published batch](evidence/transaction-recovery/08-supplier-published.png) |
| Join, canonical detail, withdraw, rejoin and refreshed list | Order `9e5b0c62-f7e2-4e75-9e80-cd6cc16efe1f`; join 201, withdrawal 200, rejoin 201, same order identity | [Join summary](evidence/transaction-recovery/09-join-summary.png), [detail](evidence/transaction-recovery/10-joined-order.png), [API evidence](evidence/transaction-recovery/offer-join.json) |
| Early readiness does not advance pickup | Order `bdb017a8-468e-4428-9e55-63aab1fbd3c8`; supplier Ready 200, buyer `paid_waiting_ready`, pickup blocked | [Pickup/readiness API evidence](evidence/transaction-recovery/pickup.json) |
| PIN handover and reuse prevention | Order `88c8b2ba-8ff8-42c7-9a4d-46d5540c9391`; initial handover 200, duplicate 409, `picked_up`, escrow `held` | [Supplier after handover](evidence/transaction-recovery/04-supplier-pickup-completed.png), [buyer after handover](evidence/transaction-recovery/05-umkm-picked-up.png) |
| Actual Midtrans sandbox QRIS settlement | Order `a3c93890-867f-4fc4-ae44-6f73facb1207`; attempt `3c0733e5-220f-4ae5-97fc-e671682e3594`; checkout 201, provider `settlement`, website reconciliation 200 / `paid` | [Payment methods](evidence/transaction-recovery/13-midtrans-payment-methods.png), [official simulator PAID](evidence/transaction-recovery/15-qris-simulator-paid.png), [buyer after refresh](evidence/transaction-recovery/16-umkm-payment-confirmed.png), [payment API evidence](evidence/transaction-recovery/payment.json) |
| Duplicate payment delivery | Signed local callback replay of actual sandbox status: 200 twice, second deduplicated; DB retains one attempt and one escrow | [Database/API verification](evidence/transaction-recovery/database-verification.json) |
| Supplier lateness, no response by agreed end, repeated refund request | Order `f342c785-a7ee-494c-a2cb-a444fcd16f09`; `refund_pending`, `supplier_late`, one full Rp10,000 refund; zero buyer strikes | [Refund detail](evidence/transaction-recovery/17-late-supplier-refund.png), [Database/API verification](evidence/transaction-recovery/database-verification.json) |
| Legacy order and invalid pickup code | Order `0538d2e6-3727-4930-87cf-0bbd9550f518`; v1 Rp10,000, original 18:00 WIB start / legacy +12h end; invalid QR rejected 409, status remains paid | [Legacy detail with secrets masked](evidence/transaction-recovery/18-legacy-order.png) |
| Final order list after build and refresh | All six QA orders visible; 22 pre-existing orders retain status, quantities, amounts and locked tiers | [Final Pesanan screen](evidence/transaction-recovery/19-orders-final-refresh.png), [Database/API verification](evidence/transaction-recovery/database-verification.json) |

The v2 handover was completed before 22:00 WIB. The later screenshot shows its completed state; it is not presented as a new handover after the cutoff. The official simulator was used according to [Midtrans sandbox testing documentation](https://docs.midtrans.com/docs/testing-payment-on-sandbox). Localhost does not receive an externally delivered provider webhook; the website's reconciliation queried Midtrans directly, and duplicate callback delivery was tested locally using the genuine returned status and a valid signature.

## Additional verification

- Vitest excluding credential-dependent live tests: **176 files, 1,338 tests passed**. Command: `node node_modules/vitest/vitest.mjs run --exclude 'tests/live/**'` (direct invocation preserves flags in PowerShell).
- Actual Supabase pickup integration test: **1 passed**, authenticated role, transaction rolled back.
- `node scripts/test-transaction-ux-sql.mjs`: complete migration replay and lifecycle scenarios passed, including explicit replacement consent, repeated lateness, pending-provider uncertainty, late repeated settlement, partial emergency cancellation and no-show eligibility. This is isolated PostgreSQL/WASM evidence, distinct from live browser evidence.
- Scoped coverage for recovery selectors, transaction errors, CSP and navigation recovery: **90.19% statements, 93.61% lines, 91.66% functions, 69.35% branches**. These percentages do not describe whole-project coverage.
- Typecheck and production build passed. Build ran the active schema preflight. The order-list browser proof was repeated after the build.
- Lint: **0 errors, 199 warnings**. Existing repository/skill/test warnings remain.

## Operational notes

`npm run db:check:transaction-ux` is read-only. `npm run build` runs it first and requires the configured PostgreSQL and server-side Supabase credentials. A missing v2 schema cannot silently pass this deployment check. Order reads still use the legacy fallback for narrowly identified absent v2 objects; database and permission failures remain visible errors, never an artificial empty list.

Dedicated QA users, fixtures and product photo remain in Supabase for inspection. They are separate from pre-existing users/orders. PRD changes remain private and were not staged. Refunds and supplier bank transfers still require the admin process; a queued refund is not described as completed money movement.

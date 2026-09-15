# TDD Evidence Report — UMKM Order Center

**Task:** Replace the UMKM order-tab mock flow with a Supabase-backed lifecycle, QRIS payment adapter, pickup/dispute/rating/refund APIs, and responsive order/detail screens.

## RED → GREEN evidence

| Area | Test-first contract | GREEN command/result |
|---|---|---|
| Lifecycle | `tests/unit/order-lifecycle.test.ts` covers valid transitions, terminal monotonicity, and timestamp-derived phases. | `npx vitest run tests/unit/order-lifecycle.test.ts` — 11 passed |
| Redis capacity | `tests/unit/registration-counter.test.ts` covers atomic reserve, unbounded tiers, and `BATCH_FULL`. | `npx vitest run tests/unit/registration-counter.test.ts` — passed |
| Schema/migration | `tests/migrations/schema.test.ts` parses the additive migration, checks enum evolution, and rejects destructive statements. | `npx vitest run tests/migrations/schema.test.ts` — 180 passed |
| Additive lifecycle objects | `tests/migrations/umkm-orders-lifecycle.test.ts` locks the new tables, policies, RPCs, and non-destructive migration shape. | `npx vitest run tests/migrations/umkm-orders-lifecycle.test.ts` — 5 passed |
| Webhook security | `tests/unit/midtrans-signature.test.ts` covers SHA512 verification and tamper rejection. | `npx vitest run tests/unit/midtrans-signature.test.ts` — 2 passed |
| Read model | `tests/unit/order-read-model.test.ts` covers server-derived deadlines/capabilities and nested DTO mapping. | `npx vitest run tests/unit/order-read-model.test.ts` — 3 passed |
| UI states | `tests/components/UmkmWorkspaceClients.test.tsx` verifies live order rendering without mock fallback. | `npx vitest run tests/components/UmkmWorkspaceClients.test.tsx` — 5 passed |

## Full verification

`npm test` → **117 test files passed, 1 skipped; 1,193 tests passed, 3 skipped**.

`npm run lint` and `npm run build` are required release gates. The live Supabase/Redis/Midtrans sandbox checks remain environment-dependent and must be run after applying migration `20260915000000_umkm_orders_lifecycle.sql` to the target project.

## Known deployment follow-up

- Apply the additive migration before enabling the new payment/detail routes.
- Configure `MIDTRANS_SERVER_KEY`, optional `MIDTRANS_BASE_URL`, and `MIDTRANS_TIMEOUT_MS` server-side only.
- Run Playwright and live provider tests against sandbox credentials; no provider secret is bundled into the client.

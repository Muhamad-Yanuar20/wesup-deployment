# Supplier Catalog API — TDD Evidence

## Scope

This checkpoint wires supplier catalog persistence to Supabase and connects the supplier UI to the API. Marketplace continues to read only `published` batches. No catalog seed data is introduced.

## RED → GREEN checkpoints

| Checkpoint | RED evidence | GREEN evidence |
| --- | --- | --- |
| Validation contract | `npx vitest run tests/unit/supplier-catalog-validation.test.ts` failed before `lib/supplier-catalog/validation.ts` existed. | 7 validation cases pass: target quantity, tier count/order/price/ranges, timeline order/future, category, absolute photo URL, and 50 km Bandung radius. |
| Persistence migration | `npx vitest run tests/migrations/supplier-catalog-persistence.test.ts` failed before migration `20260909000000_supplier_catalog_persistence.sql`. | 8 migration contract cases pass: `pickup_name` backfill, six RPCs, security-definer/search-path, grants, ownership, approval, participant locks, and draft-only deletion. |
| Supplier API | `npx vitest run tests/unit/api-supplier-catalog.test.ts` failed before the route handlers existed. | Create/publish, malformed payload, list/counts, 401, pending-supplier 403, and storage rollback cases pass. |
| Detail/edit API | The detail route test initially failed because the route did not exist. | `tests/unit/api-supplier-catalog-detail.test.ts` passes detail read, photo replacement after successful update, and empty-draft hard delete. |
| UI states | Catalog list initially rendered static mocks. | `tests/components/SupplierCatalogUi.test.tsx` passes skeleton → real card/photo, empty state, retryable error, and status/image rendering. |

## Verification commands

- `npx tsc --noEmit` — pass.
- `npm run lint` — pass with pre-existing warnings in unrelated test fixtures.
- Targeted catalog suite: `npx vitest run tests/unit/api-supplier-catalog.test.ts tests/unit/api-supplier-catalog-detail.test.ts tests/unit/supplier-catalog-validation.test.ts tests/migrations/supplier-catalog-persistence.test.ts tests/components/SupplierCatalogUi.test.tsx` — 5 files / 28 tests pass.
- Full `npm test`, `npm run build`, and live Supabase integration should be run after the migration is applied to the target project; live fixtures must be cleaned up and no permanent catalog seeder is required.

## Manual smoke path

1. Apply the supplier catalog migration to the Supabase project.
2. Sign in as an active, Admin-approved supplier.
3. Open `/supplier/catalog/new`; choose a JPEG/PNG/WebP photo and confirm the Web Worker compression state.
4. Save a draft and confirm it appears only in the Draft tab.
5. Edit the draft and publish it. Confirm the API response has an absolute `product_photo_url` and the item appears in `/marketplace` without a server refresh.
6. Cancel a published batch; confirm it disappears from Marketplace. Delete an empty draft from its detail page.

The migration file is intentionally committed as source; the configured Supabase project has now received the migrations listed above.
## Final live verification — 2026-09-09

The target Supabase project was migrated with the supplier catalog persistence,
ownership/atomic publish, audit enum, and authentication-order migrations. No
seed data was added.

```text
npx vitest run tests/live/database.integration.test.ts tests/live/auth-rls.integration.test.ts --reporter=dot
Test Files  2 passed (2)
Tests       238 passed (238)

npx vitest run tests/live/cancellation-search.integration.test.ts --reporter=dot
Test Files  1 passed (1)
Tests       12 passed (12)

npm test
Test Files  74 passed (74)
Tests       1016 passed (1016)

npx tsc --noEmit — pass
npm run lint — pass (9 pre-existing warnings in test fixtures)
npm run build — pass
```
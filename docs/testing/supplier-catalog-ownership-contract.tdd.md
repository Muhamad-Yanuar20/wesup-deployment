# Supplier Catalog Ownership Contract — TDD Evidence

## Red

Added `tests/migrations/supplier-catalog-ownership-contract.test.ts` before the
follow-up migration existed.

```text
npx vitest run tests/migrations/supplier-catalog-ownership-contract.test.ts --reporter=verbose
Test Files  1 failed
Tests       9 failed
```

The failures were expected: the additive ownership-contract migration and its
RPCs did not yet exist.

## Green

Added `20260909010000_supplier_catalog_ownership_contract.sql`, including:

- private owner and active-approved-supplier assertions;
- `P0002` missing-batch and `42501` cross-owner errors;
- `22023` validation and `55000` lifecycle errors for hardened mutations;
- narrowed grants for the public RPCs and no direct helper execution; and
- the supplier dashboard aggregate RPC.

```text
npx vitest run tests/migrations/supplier-catalog-ownership-contract.test.ts tests/migrations/supplier-catalog-persistence.test.ts tests/migrations/schema.test.ts --reporter=verbose
Test Files  3 passed (3)
Tests       196 passed (196)

npx tsc --noEmit
exit 0
```

No Supabase project was migrated as part of this task.

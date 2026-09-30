import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260920020000_batched_order_materialization.sql"),
  "utf8",
);

describe("materialize_umkm_orders", () => {
  it("accepts a list of registration ids in a single call", () => {
    expect(migration).toMatch(
      /create or replace function public\.materialize_umkm_orders\(p_registration_ids uuid\[\]\)/i,
    );
  });

  it("delegates the lifecycle rules to the single-order function so they stay defined once", () => {
    expect(migration).toMatch(/perform public\.materialize_umkm_order\(v_registration_id\)/i);
  });

  it("sweeps each distinct batch once rather than once per registration", () => {
    // The old fan-out re-ran materialize_supplier_batch for every row, so a page
    // of orders from one batch repeated the same sweep N times.
    expect(migration).toMatch(/select distinct r\.batch_id/i);
    expect(migration).toMatch(/perform public\.materialize_supplier_batch\(v_batch_id\)/i);
  });

  it("isolates every row so one bad registration cannot fail the read", () => {
    // This is the guarantee the previous Promise.allSettled fan-out gave the
    // route. A batch-level failure of the whole RPC would break the order list.
    const rowBlocks = migration.match(/exception when others then\s+null;/gi) ?? [];
    expect(rowBlocks.length).toBeGreaterThanOrEqual(2);
  });

  it("still refuses to run without a signed-in caller", () => {
    expect(migration).toMatch(/if auth\.uid\(\) is null then/i);
    expect(migration).toMatch(/raise exception 'sign in required' using errcode = '42501'/i);
  });

  it("returns early for an empty list instead of running any sweep", () => {
    expect(migration).toMatch(
      /if p_registration_ids is null or cardinality\(p_registration_ids\) = 0 then\s+return 0;/i,
    );
  });

  it("is executable by signed-in users and the service role, but not anon", () => {
    expect(migration).toMatch(
      /revoke execute on function public\.materialize_umkm_orders\(uuid\[\]\) from public, anon/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.materialize_umkm_orders\(uuid\[\]\) to authenticated, service_role/i,
    );
  });

  it("is additive only", () => {
    expect(migration).not.toMatch(/DROP\s+TABLE|TRUNCATE\s+TABLE/i);
    expect(migration).not.toMatch(/drop\s+function/i);
  });
});

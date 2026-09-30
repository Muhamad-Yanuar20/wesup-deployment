import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260920010000_query_aggregates.sql"),
  "utf8",
);

describe("sum_registered_quantity", () => {
  it("aggregates in the database instead of returning rows", () => {
    expect(migration).toMatch(
      /create or replace function public\.sum_registered_quantity\(p_batch_id uuid\)/i,
    );
    expect(migration).toMatch(/returns bigint/i);
    expect(migration).toMatch(/coalesce\(sum\(r\.quantity\), 0\)::bigint/i);
  });

  it("uses the same status filter as cut_off_batch so the two totals cannot drift", () => {
    // cut_off_batch reconciles the identical total; if either filter changes,
    // this test is the thing that should fail.
    expect(migration).toMatch(/r\.status in \('registered', 'pending_payment'\)/i);
  });

  it("is restricted to the service role, like the admin client that calls it", () => {
    expect(migration).toMatch(
      /revoke execute on function public\.sum_registered_quantity\(uuid\) from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.sum_registered_quantity\(uuid\) to service_role/i,
    );
  });

  it("is additive only", () => {
    expect(migration).not.toMatch(/DROP\s+TABLE|TRUNCATE\s+TABLE/i);
    expect(migration).not.toMatch(/drop\s+function/i);
  });
});

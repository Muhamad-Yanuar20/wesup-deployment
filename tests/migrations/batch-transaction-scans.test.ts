import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = "20260920040000_consolidate_batch_transaction_scans.sql";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", MIGRATION),
  "utf8",
);

/** Only the function body, so grants and comments cannot skew the counts. */
const functionSource = (() => {
  const start = migration.search(
    /create or replace function public\.get_supplier_batch_transaction/i,
  );
  const end = migration.indexOf("$$;", start);
  return migration.slice(start, end === -1 ? undefined : end);
})();

function countOf(pattern: RegExp): number {
  return (functionSource.match(pattern) ?? []).length;
}

describe("get_supplier_batch_transaction scan consolidation", () => {
  it("aggregates the batch's registrations exactly once", () => {
    // The old body scanned public.registrations nine times: three derived
    // batch totals, three capability predicates, the summary, and the orders
    // projection. Only the orders projection legitimately needs per-row data,
    // so the aggregate form must appear once and the correlated subquery form
    // must not appear at all.
    expect(countOf(/group by r\.batch_id/i)).toBe(1);
    expect(countOf(/\(select\s+[^)]*from public\.registrations/gi)).toBe(0);
  });

  it("derives every batch total and capability flag from the one grouped pass", () => {
    // The three derived batch totals.
    expect(functionSource).toMatch(
      /sum\(r\.quantity\) filter \(where r\.status <> 'cancelled'\)/i,
    );
    expect(functionSource).toMatch(/count\(\*\) filter \(where r\.status <> 'cancelled'\)/i);
    expect(functionSource).toMatch(
      /count\(\*\) filter \(where r\.status in \('paid', 'picked_up', 'completed'\)\)/i,
    );
    // The three capability predicates that used to be separate exists/sum scans.
    expect(functionSource).toMatch(/sum\(r\.quantity\) filter \(where r\.status = 'registered'\)/i);
    expect(functionSource).toMatch(/bool_or\(r\.status in \('picked_up', 'completed'\)\)/i);
    expect(functionSource).toMatch(/bool_or\(r\.status = 'paid'\)/i);
  });

  it("stops re-reading scalar columns that the batch document already carries", () => {
    // The old trailing jsonb_build_object issued ten
    // (select <column> from public.batches where id = p_batch_id) subqueries for
    // values already selected into the batch object.
    expect(countOf(/\(select\s+\w+\s+from public\.batches where id = p_batch_id\)/gi)).toBe(0);
  });

  it("keeps the six summary buckets and their exact groupings", () => {
    expect(functionSource).toMatch(/count\(\*\) filter \(where r\.status = 'registered'\)/i);
    expect(functionSource).toMatch(/count\(\*\) filter \(where r\.status = 'pending_payment'\)/i);
    expect(functionSource).toMatch(/count\(\*\) filter \(where r\.status = 'paid'\)/i);
    expect(functionSource).toMatch(
      /count\(\*\) filter \(where r\.status in \('picked_up', 'completed'\)\)/i,
    );
    expect(functionSource).toMatch(
      /count\(\*\) filter \(where r\.status in \('cancelled', 'no_show'\)\)/i,
    );
    expect(functionSource).toMatch(
      /count\(\*\) filter \(where r\.status in \('refund_pending', 'refunded'\)\)/i,
    );
  });

  it("coalesces the grouped pass so a batch with no registrations still reads zero", () => {
    // A GROUP BY yields no row at all for an empty batch, so every derived
    // number has to fall back to zero rather than null. The summary must also
    // keep all six keys present instead of collapsing to {}.
    expect(functionSource).toMatch(/coalesce\(s\.registered_quantity, 0\)/i);
    expect(functionSource).toMatch(/coalesce\(s\.participant_count, 0\)/i);
    expect(functionSource).toMatch(/coalesce\(s\.paid_participant_count, 0\)/i);
    expect(functionSource).toMatch(/coalesce\(s\.registered_quantity_for_close, 0\)/i);
    expect(functionSource).toMatch(/coalesce\(s\.total_quantity, 0\)/i);
    expect(functionSource).toMatch(/coalesce\(s\.total_amount, 0\)/i);
  });

  it("keeps commercial editing and pickup blocks owner-gated", () => {
    // These are the two flags where dropping the owner check would hand a
    // stranger write access, so the guards are asserted literally.
    expect(functionSource).toMatch(
      /'canEditCommercialFields',\s*v_supplier_id = auth\.uid\(\)\s+and b\.status in \('draft', 'published'\)\s+and coalesce\(s\.registration_count, 0\) = 0/i,
    );
    expect(functionSource).toMatch(
      /'canConfirmPickup',\s*v_supplier_id = auth\.uid\(\)\s+and coalesce\(s\.has_paid, false\)/i,
    );
  });

  it("blocks commercial editing on registration_count, not participant_count", () => {
    // participant_count excludes cancelled registrations, but the old check was
    // not exists over every row. A batch whose only registration was cancelled
    // must still refuse commercial editing, so the unfiltered count is the one
    // that has to be compared against zero.
    expect(functionSource).toMatch(/count\(\*\) as registration_count/i);
    expect(functionSource).toMatch(/coalesce\(s\.participant_count, 0\)/i);
  });

  it("keeps the dispute flag ungated by ownership", () => {
    // Admin reconciliation depends on this staying visible to non-owners.
    expect(functionSource).toMatch(
      /'canViewDispute',\s*v_has_dispute/i,
    );
    expect(functionSource).not.toMatch(
      /'canViewDispute',\s*v_supplier_id = auth\.uid\(\)/i,
    );
  });

  it("keeps capabilities empty when the batch has no timeline row", () => {
    // The old body built capabilities from an inner join on batch_timeline, so a
    // batch with no timeline produced an empty capability object while its batch
    // document was still populated by a left join. The single joined read has to
    // reproduce that with an explicit guard, otherwise such a batch would start
    // handing out flags.
    expect(functionSource).toMatch(
      /case when t\.batch_id is null then '\{\}'::jsonb\s+else jsonb_build_object\(/i,
    );
  });

  it("keeps the authorization gate, error codes and messages", () => {
    expect(functionSource).toMatch(
      /if auth\.uid\(\) is null then raise exception 'sign in required' using errcode = '42501'/i,
    );
    expect(functionSource).toMatch(
      /raise exception 'batch not found' using errcode = 'P0002'/i,
    );
    expect(functionSource).toMatch(
      /raise exception 'batch access denied' using errcode = '42501'/i,
    );
    expect(functionSource).toMatch(
      /raise exception 'active approved supplier required' using errcode = '42501'/i,
    );
  });

  it("keeps the signature, volatility, security and grants", () => {
    expect(migration).toMatch(
      /create or replace function public\.get_supplier_batch_transaction\(p_batch_id uuid\)\s*returns jsonb\s*language plpgsql stable security definer set search_path = public/i,
    );
    expect(migration).toMatch(
      /revoke execute on function public\.get_supplier_batch_transaction\(uuid\) from public, anon/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.get_supplier_batch_transaction\(uuid\) to authenticated/i,
    );
  });

  it("is additive only", () => {
    expect(migration).not.toMatch(/DROP\s+TABLE|TRUNCATE\s+TABLE/i);
    expect(migration).not.toMatch(/drop\s+function/i);
  });
});

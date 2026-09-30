import { readFileSync, readdirSync } from "node:fs";
import { describe, it, expect } from "vitest";
const source = () => readFileSync(`supabase/migrations/${readdirSync("supabase/migrations").find(n=>n.endsWith("_payment_clarity_capacity_opening.sql"))}`, "utf8");
describe("capacity-opening migration contract",()=>{
  it("preserves existing policies and explicitly opts new publication in",()=>{
    expect(source()).toContain("default 'fixed_cutoff'");
    expect(source()).toMatch(/publish_supplier_offer[\s\S]*'capacity_or_cutoff'/);
    expect(source()).toContain("provider_checked_at timestamptz");
  });
  it("closes full registrations in the joining transaction with one invoice authority",()=>{
    expect(source()).toMatch(/join_batch_v2[\s\S]*perform public.close_batch_and_issue_invoices\(b.id,'capacity_reached'\)/);
    expect(source()).toContain("interval '24 hours'");
    expect(source()).toContain("paymentOpeningPolicy");
  });
  it("keeps recovery ownership-gated and returns actual deadlines",()=>{
    expect(source()).toContain("'batchClosed'");
    expect(source()).toContain("'deadlineAt'");
    expect(source()).toContain("provider_checked_at");
    expect(source()).toContain("r.umkm_id=auth.uid()");
  });
});

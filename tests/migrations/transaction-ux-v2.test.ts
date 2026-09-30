import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("versioned transaction UX migration", () => {
  const source = () => readFileSync("supabase/migrations/20260930000000_transaction_ux_v2.sql", "utf8");
  it("keeps existing batches legacy and stores private partial drafts", () => {
    expect(source()).toMatch(/transaction_policy_version smallint not null default 1/i);
    expect(source()).toMatch(/supplier_offer_drafts[\s\S]*enable row level security/i);
  });
  it("includes atomic withdrawal and rejoin with ownership and cutoff backstops", () => {
    expect(source()).toContain("withdraw_batch_registration");
    expect(source()).toContain("join_batch_v2");
    expect(source()).toContain("for update");
  });
  it("stores explicit replacement acceptance and does not penalize supplier delay", () => {
    expect(source()).toContain("accepted_pickup_revision");
    expect(source()).toContain("supplier_late");
    expect(source()).toContain("decide_pickup_replacement");
  });
});

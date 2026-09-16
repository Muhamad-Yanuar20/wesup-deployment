import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260917000000_midtrans_snap_checkout.sql",
);

describe("Midtrans Snap checkout migration contract", () => {
  it("adds private checkout sessions and the supported attempt metadata", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/alter table public\.payment_attempts/i);
    expect(sql).toMatch(/integration_type/i);
    expect(sql).toMatch(/provider_status/i);
    expect(sql).toMatch(/provider_fraud_status/i);
    expect(sql).toMatch(/create table if not exists public\.payment_checkout_sessions/i);
    expect(sql).toMatch(/snap_token/i);
    expect(sql).toMatch(/revoke select,.*payment_checkout_sessions.*authenticated/i);
  });

  it("defines an atomic Midtrans event RPC with restricted execution", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/create or replace function public\.apply_midtrans_payment_event/i);
    expect(sql).toMatch(/on conflict \(registration_id\) do nothing/i);
    expect(sql).toMatch(/revoke execute on function public\.apply_midtrans_payment_event/i);
    expect(sql).toMatch(/grant execute on function public\.apply_midtrans_payment_event.*service_role/i);
  });
});

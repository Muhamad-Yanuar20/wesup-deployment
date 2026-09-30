import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260915000000_umkm_orders_lifecycle.sql"),
  "utf8",
);

describe("UMKM order lifecycle migration contract", () => {
  it("is additive and adds the catalog unit allowlist", () => {
    expect(migration).not.toMatch(/DROP\s+TABLE|TRUNCATE\s+TABLE/i);
    expect(migration).toMatch(/add column if not exists unit text not null default 'pcs'/i);
    expect(migration).toMatch(/batches_unit_check/i);
  });

  it("creates one-pending-attempt and webhook hash deduplication guards", () => {
    expect(migration).toMatch(/create table if not exists public\.payment_attempts/i);
    expect(migration).toMatch(/payment_attempts_one_pending/i);
    expect(migration).toMatch(/payment_webhook_logs_payload_hash_unique/i);
  });

  it("allows escrow to exist before pickup and supports frozen disputes", () => {
    expect(migration).toMatch(/pickup_confirmed_at drop not null/i);
    expect(migration).toMatch(/auto_release_at drop not null/i);
    expect(migration).toMatch(/alter type public\.escrow_status add value.*frozen/i);
  });

  it("stores a complaint category and append-only status events", () => {
    expect(migration).toMatch(/complaint_category text not null default 'cacat'/i);
    expect(migration).toMatch(/create table if not exists public\.registration_status_events/i);
    expect(migration).toMatch(/registration_status_event_insert/i);
  });

  it("hardens direct writes and exposes the lifecycle RPC surface", () => {
    expect(migration).toMatch(/drop policy if exists "registrations_umkm_all"/i);
    for (const functionName of [
      "materialize_umkm_order",
      "finalize_payment",
      "submit_order_complaint",
      "submit_order_rating",
      "attach_refund_bank_account",
      "confirm_pickup",
    ]) {
      expect(migration).toMatch(new RegExp(`create or replace function public\\.${functionName}`, "i"));
    }
  });
});
